import * as THREE from "three";

type ShelfFurnitureOptions = {
  boardThickness: number;
  cabinetHeight: number;
  shelfHeights: readonly number[];
  shelfWidth: number;
};

export class ShelfFurnitureBuilder {
  build(options: ShelfFurnitureOptions): THREE.Group {
    const furniture = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({
      color: "#5a301d",
      roughness: 0.62,
      metalness: 0.03,
    });
    const woodEdge = new THREE.MeshStandardMaterial({
      color: "#32170e",
      roughness: 0.72,
    });
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(options.shelfWidth, options.cabinetHeight, 0.42),
      wood,
    );
    back.position.set(0, options.cabinetHeight / 2, -0.72);
    back.receiveShadow = true;
    furniture.add(back);

    [-options.shelfWidth / 2 + 0.22, options.shelfWidth / 2 - 0.22].forEach(
      (x) => {
        const side = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, options.cabinetHeight + 0.5, 1.3),
          woodEdge,
        );
        side.position.set(x, options.cabinetHeight / 2, 0);
        side.castShadow = true;
        furniture.add(side);
      },
    );

    options.shelfHeights.forEach((height) => {
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(
          options.shelfWidth - 0.42,
          options.boardThickness,
          1.45,
        ),
        woodEdge,
      );
      board.position.set(0, height, -0.05);
      board.receiveShadow = true;
      board.castShadow = true;
      furniture.add(board);
    });
    return furniture;
  }
}
