import { Color3, Engine, FlyCamera, HemisphericLight, Scene, StandardMaterial, Vector3 } from '@babylonjs/core'
import Planet, { NoiseParams, PlanetManager } from './planet';

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

const engine = new Engine(canvas, true);

const createScene = () => {
    const planetCount = 10;

    const scene = new Scene(engine);

    const camera = new FlyCamera("camera", new Vector3(0, 60, 0), scene);
    camera.rollCorrect = 10;
    camera.bankedTurn = true;
    camera.attachControl(true);

    new HemisphericLight("light", new Vector3(1.5, 1, 0).normalize(), scene);

    const rand = (min: number, max: number): number => Math.random() * (max - min) + min;

    const createPlanet = (name: string) => {
        const radius = rand(20.0, 100.0);
        const distance = rand(200, 5000);
        const theta = rand(0, 2 * Math.PI);
        const position = new Vector3(distance * Math.cos(theta), rand(-50, 50), distance * Math.sin(theta));

        const heightParams = new NoiseParams();
        heightParams.amplitude = radius * 0.05;
        heightParams.frequency = new Vector3(0.1, 0.1, 0.1);
        heightParams.octaveAmplitude = 0.2;
        heightParams.octaveScale = 4.0;

        const color1 = Color3.FromHSV(rand(0, 360), rand(0.6, 0.9), rand(0.5, 0.8));
        const color2 = Color3.FromHSV(rand(0, 360), rand(0.6, 0.9), rand(0.5, 0.8));

        const planet = new Planet(name, radius, color1, color2, { height: heightParams });
        planet.position = position;

        const texture = planet.createTexture(`${name}.texture`, 64, 1, scene);

        const material = new StandardMaterial(`${name}.material`, scene);
        material.diffuseTexture = texture;
        material.ambientColor = new Color3(0.1, 0.1, 0.1);
        material.specularColor = Color3.Black();

        planet.material = material;

        return planet;
    };

    const homePlanet = (name: string) => {
        const radius = 50.0;

        const heightParams = new NoiseParams();
        heightParams.amplitude = radius * 0.05;
        heightParams.frequency = new Vector3(0.1, 0.1, 0.1);
        heightParams.octaveAmplitude = 0.2;
        heightParams.octaveScale = 4.0;

        const color1 = Color3.FromHSV(rand(0, 360), rand(0.6, 0.9), rand(0.5, 0.8));
        const color2 = Color3.FromHSV(rand(0, 360), rand(0.6, 0.9), rand(0.5, 0.8));

        const planet = new Planet(name, radius, color1, color2, { height: heightParams });

        const texture = planet.createTexture(`${name}.texture`, 64, 1, scene);

        const material = new StandardMaterial(`${name}.material`, scene);
        material.diffuseTexture = texture;
        material.ambientColor = new Color3(0.1, 0.1, 0.1);
        material.specularColor = Color3.Black();

        planet.material = material;

        return planet;
    };

    const planets = new PlanetManager(camera);

    planets.planets.push(homePlanet("planet.home"));

    for (let i = 0; i < planetCount; i++) {
        planets.planets.push(createPlanet(`planet.${i}`));
    }

    return { scene, planets };
}

const { scene, planets } = createScene();

let tick = 0;

engine.runRenderLoop(() => {
    const delta = engine.getDeltaTime();

    tick += delta;

    if (tick > 100) {
        planets.tick(scene);
        tick = 0;
    }

    scene.render();
});

window.addEventListener("resize", () => engine.resize());

