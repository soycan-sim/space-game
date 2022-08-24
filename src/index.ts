import { ArcRotateCamera, Color3, Engine, FlyCamera, HemisphericLight, Scene, StandardMaterial, Vector3 } from '@babylonjs/core'
import Planet, { NoiseParams } from './planet';

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

const engine = new Engine(canvas, true);

const createScene = () => {
    const planetCount = 100;

    const scene = new Scene(engine);

    const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 100, new Vector3(0, 0, 0));
    camera.attachControl(canvas, true);

    // const camera = new FlyCamera("camera", new Vector3(0, 0, 0), scene);
    // camera.rollCorrect = 10;
    // camera.bankedTurn = true;
    // camera.attachControl(true);

    const light = new HemisphericLight("light", new Vector3(1, 3, 0), scene);

    const rand = (min: number, max: number): number => Math.random() * (max - min) + min;

    const createPlanet = (name: string) => {
        const radius = rand(1.0, 10.0);
        const distance = rand(50, 250);
        const theta = rand(0, 2 * Math.PI);
        const position = new Vector3(distance * Math.cos(theta), rand(-50, 50), distance * Math.sin(theta));

        const heightParams = new NoiseParams();
        heightParams.amplitude = radius * 0.05;
        heightParams.frequency = new Vector3(0.2, 0.2, 0.2);
        heightParams.octaveAmplitude = 0.2;
        heightParams.octaveScale = 4.0;

        const color1 = Color3.FromHSV(rand(0, 360), rand(0.6, 0.9), rand(0.5, 0.8));
        const color2 = Color3.FromHSV(rand(0, 360), rand(0.6, 0.9), rand(0.5, 0.8));

        const planet = new Planet(radius, color1, color2, { height: heightParams });

        const texture = planet.createTexture(`${name}.texture`, 64, 1, scene);

        const material = new StandardMaterial(`${name}.material`, scene);
        material.diffuseTexture = texture;
        material.ambientColor = new Color3(0.1, 0.1, 0.1);
        material.specularColor = Color3.Black();

        const planet0 = planet.createMesh(`${name}.lod0`, 4, scene);
        const planet1 = planet.createMesh(`${name}.lod1`, 3, scene);
        const planet2 = planet.createMesh(`${name}.lod2`, 2, scene);
        const planet3 = planet.createMesh(`${name}.lod3`, 1, scene);

        planet0.material = material;
        planet1.material = material;
        planet2.material = material;
        planet3.material = material;

        planet0.useLODScreenCoverage = true;
        planet0.addLODLevel(0.3, planet1);
        planet0.addLODLevel(0.1, planet2);
        planet0.addLODLevel(0.05, planet3);

        planet0.position = position;
    };

    for (let i = 0; i < planetCount; i++) {
        createPlanet(`planet.${i}`);
    }

    return scene;
}

const scene = createScene();

engine.runRenderLoop(() => {
    scene.render();
});

window.addEventListener("resize", () => engine.resize());

