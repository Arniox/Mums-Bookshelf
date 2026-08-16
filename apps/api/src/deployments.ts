import type { Context } from "hono";
import { ApiError, success } from "./http";
import type { AppEnvironment } from "./types";

interface WorkflowDispatchResponse {
  workflow_run_id?: number;
  html_url?: string;
}

const repositoryPart = /^[A-Za-z0-9_.-]+$/;
const workflowFile = /^[A-Za-z0-9_.-]+\.ya?ml$/;
const gitReference = /^[A-Za-z0-9_./-]+$/;

export async function triggerPagesDeployment(
  context: Context<AppEnvironment>,
) {
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
      "The work was saved, but the website update could not be started. Please try Update public website again.",
    );
  }

  let dispatch: WorkflowDispatchResponse = {};
  if (response.status !== 204) {
    dispatch = (await response.json()) as WorkflowDispatchResponse;
  }

  return success(context, {
    queued: true,
    runId: dispatch.workflow_run_id,
    runUrl: dispatch.html_url,
  });
}
