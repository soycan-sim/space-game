import { ArcRotateCamera, Engine, HemisphericLight, MeshBuilder, Scene, Vector3 } from '@babylonjs/core'
import { sceneUboDeclaration } from '@babylonjs/core/Shaders/ShadersInclude/sceneUboDeclaration';

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

const engine = new Engine(canvas, true);

const createScene = () => {
    const scene = new Scene(engine);

    const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 3, new Vector3(0, 0, 0));
    camera.attachControl(canvas, true);

    const light = new HemisphericLight("light", new Vector3(1, 3, 0), scene);

    const box = MeshBuilder.CreateBox("box");

    return scene;
}

const scene = createScene();

engine.runRenderLoop(() => {
    scene.render();
});

window.addEventListener("resize", () => engine.resize());

