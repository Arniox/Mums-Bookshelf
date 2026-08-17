import type { Context } from "hono";
import { ApiError, success } from "./http";
import type { AppEnvironment } from "./types";

interface WorkflowDispatchResponse {
  workflow_run_id?: number;
  html_url?: string;
}

interface WorkflowRun {
  id: number;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowRunsResponse {
  workflow_runs?: WorkflowRun[];
}

interface WorkflowStep {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
}

interface WorkflowJob {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  steps?: WorkflowStep[];
}

interface WorkflowJobsResponse {
  jobs?: WorkflowJob[];
}

const repositoryPart = /^[A-Za-z0-9_.-]+$/;
const workflowFile = /^[A-Za-z0-9_.-]+\.ya?ml$/;
const gitReference = /^[A-Za-z0-9_./-]+$/;

function stageForJob(job?: WorkflowJob): string | undefined {
  if (!job) return undefined;
  const jobName = job.name.toLowerCase();
  if (jobName.includes("deploy"))
    return job.status === "queued" ? "deploy-waiting" : "deploying";
  const activeStep = job.steps?.find((step) => step.status === "in_progress");
  if (!activeStep) return job.status === "queued" ? "waiting" : undefined;
  if (activeStep.name === "npm ci") return "packing";
  if (activeStep.name === "npm run format:check") return "tidying";
  if (activeStep.name === "npm run lint") return "checking";
  if (activeStep.name === "npm run typecheck") return "checking";
  if (activeStep.name === "npm test") return "testing";
  if (activeStep.name === "npm run build -w @mums-bookshelf/shared")
    return "binding";
  if (activeStep.name === "npm run build -w @mums-bookshelf/api")
    return "building-api";
  if (activeStep.name === "Apply D1 migrations") return "filing";
  if (activeStep.name === "Deploy Cloudflare Worker") return "sending-api";
  if (activeStep.name === "npm run build -w @mums-bookshelf/web")
    return "building-pages";
  if (activeStep.name === "actions/upload-pages-artifact@v5")
    return "packing-pages";
  return "checking";
}

function deploymentConfiguration(context: Context<AppEnvironment>) {
  const token = context.env.GITHUB_PAGES_DEPLOY_TOKEN;
  const [owner, repository, extra] = context.env.GITHUB_REPOSITORY.split("/");
  const workflow = context.env.GITHUB_PAGES_WORKFLOW;
  const reference = context.env.GITHUB_DEFAULT_BRANCH;

  if (
    !token ||
    !owner ||
    !repository ||
    extra ||
    !repositoryPart.test(owner) ||
    !repositoryPart.test(repository) ||
    !workflowFile.test(workflow) ||
    !gitReference.test(reference)
  ) {
    throw new ApiError(
      503,
      "deployment_not_configured",
      "Automatic website updates are not configured yet.",
    );
  }

  return { token, owner, repository, workflow, reference };
}

export async function triggerPagesDeployment(context: Context<AppEnvironment>) {
  const { token, owner, repository, workflow, reference } =
    deploymentConfiguration(context);
  const requestedAt = new Date().toISOString();

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repository}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "mums-bookshelf-worker",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      body: JSON.stringify({ ref: reference }),
    },
  );

  if (!response.ok) {
    console.error(
      JSON.stringify({
        event: "pages_deployment_dispatch_failed",
        requestId: context.get("requestId"),
        githubStatus: response.status,
      }),
    );
    await response.body?.cancel();
    throw new ApiError(
      502,
      "deployment_dispatch_failed",
      "Your changes were saved, but the website update could not be started. Please try Update public website again.",
    );
  }

  let dispatch: WorkflowDispatchResponse = {};
  if (response.status !== 204) {
    dispatch = await response
      .json<WorkflowDispatchResponse>()
      .catch(() => ({}));
  }

  return success(context, {
    queued: true,
    requestedAt,
    runId: dispatch.workflow_run_id,
    runUrl: dispatch.html_url,
  });
}

export async function getPagesDeploymentStatus(
  context: Context<AppEnvironment>,
) {
  const { token, owner, repository, workflow, reference } =
    deploymentConfiguration(context);
  const since = context.req.query("since");
  const sinceTime = since ? Date.parse(since) : Number.NaN;
  if (since && Number.isNaN(sinceTime))
    throw new ApiError(
      400,
      "invalid_deployment_timestamp",
      "The deployment timestamp is invalid.",
    );

  const parameters = new URLSearchParams({
    event: "workflow_dispatch",
    branch: reference,
    per_page: "10",
  });
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repository}/actions/workflows/${workflow}/runs?${parameters}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "mums-bookshelf-worker",
        "X-GitHub-Api-Version": "2026-03-10",
      },
    },
  );
  if (!response.ok) {
    console.error(
      JSON.stringify({
        event: "pages_deployment_status_failed",
        requestId: context.get("requestId"),
        githubStatus: response.status,
      }),
    );
    await response.body?.cancel();
    throw new ApiError(
      502,
      "deployment_status_failed",
      "The website refresh status could not be checked.",
    );
  }

  const payload = (await response.json()) as WorkflowRunsResponse;
  const run = (payload.workflow_runs || []).find(
    (candidate) => !since || Date.parse(candidate.created_at) >= sinceTime,
  );
  if (!run) return success(context, { state: since ? "starting" : "idle" });

  const state =
    run.status === "queued"
      ? "queued"
      : run.status === "in_progress"
        ? "building"
        : run.conclusion === "success"
          ? "ready"
          : "failed";
  let stage: string | undefined;
  if (state === "building") {
    const jobsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repository}/actions/runs/${run.id}/jobs?per_page=20`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "mums-bookshelf-worker",
          "X-GitHub-Api-Version": "2026-03-10",
        },
      },
    );
    if (jobsResponse.ok) {
      const jobs = (await jobsResponse.json()) as WorkflowJobsResponse;
      stage = stageForJob(
        jobs.jobs?.find((job) => job.status === "in_progress") ||
          jobs.jobs?.find((job) => job.status === "queued"),
      );
    } else {
      await jobsResponse.body?.cancel();
    }
  }
  return success(context, {
    state,
    ...(stage ? { stage } : {}),
    runId: run.id,
    runUrl: run.html_url,
    startedAt: run.created_at,
    updatedAt: run.updated_at,
  });
}
