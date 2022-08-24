import { Mesh, RawTexture, Scene, Texture, Vector2, Vector3, VertexData } from "@babylonjs/core";
import { createNoise3D, NoiseFunction3D } from "simplex-noise";

type PlanetOptions = { offset?: number, amplitude?: number, frequency?: Vector3, diffuseFrequency?: Vector3 };

class Planet {
    readonly radius: number;
    readonly offset: number;
    readonly amplitude: number;
    readonly frequency: Vector3;
    readonly diffuseFrequency: Vector3;
    private heightFunc: NoiseFunction3D;
    private diffuseFunc: NoiseFunction3D;

    private static defaultOptions = {
        offset: 0,
        amplitude: 0.1,
        frequency: new Vector3(1.0, 1.0, 1.0),
        diffuseFrequency: new Vector3(8.0, 8.0, 8.0),
    };

    constructor(radius: number, options?: PlanetOptions) {
        this.radius = radius;
        this.offset = options?.offset ?? Planet.defaultOptions.offset;
        this.amplitude = options?.amplitude ?? Planet.defaultOptions.amplitude;
        this.frequency = options?.frequency ?? Planet.defaultOptions.frequency;
        this.diffuseFrequency = options?.diffuseFrequency ?? Planet.defaultOptions.diffuseFrequency;

        this.heightFunc = createNoise3D();
        this.diffuseFunc = createNoise3D();
    }

    createTexture(name: string, res: number, scene: Scene): RawTexture {
        let quads = [
            [0, 1, 2, 3],
            [5, 4, 3, 2],
            [6, 5, 2, 1],
            [7, 0, 3, 4],
            [4, 5, 6, 7],
            [7, 6, 1, 0],
        ];

        const points = [
            new Vector3(0, 0, 0),
            new Vector3(1, 0, 0),
            new Vector3(1, 1, 0),
            new Vector3(0, 1, 0),
            new Vector3(0, 1, 1),
            new Vector3(1, 1, 1),
            new Vector3(1, 0, 1),
            new Vector3(0, 0, 1),
        ];

        const blockCoords = quads.map((quad) => quad.map((i) => points[i])).flat();
        const texCoords = quads.map((_, index) => [
            new Vector2((index % 3) / 3, Math.trunc(index / 3) / 3),
            new Vector2((index % 3 + 1) / 3, Math.trunc(index / 3) / 3),
            new Vector2((index % 3 + 1) / 3, Math.trunc(index / 3 + 1) / 3),
            new Vector2((index % 3) / 3, Math.trunc(index / 3 + 1) / 3),
        ]).flat();

        quads = [
            [0, 1, 2, 3],
            [4, 5, 6, 7],
            [8, 9, 10, 11],
            [12, 13, 14, 15],
            [16, 17, 18, 19],
            [20, 21, 22, 23],
        ];

        const width = res * 3;
        const xStride = 3;
        const yStride = width * xStride;
        const size = width * yStride;
        const data = new Uint8Array(size);

        for (const [i, j, k, l] of quads) {
            const a = blockCoords[i];
            const b = blockCoords[j];
            const c = blockCoords[k];
            const d = blockCoords[l];

            const uv0 = texCoords[i];

            for (let y = 0; y < res; y++) {
                const t = y / res;

                const ad = a.add(d.subtract(a).scale(t));
                const bc = b.add(c.subtract(b).scale(t));

                const v = width * uv0.y + y;

                for (let x = 0; x < res; x++) {
                    const r = x / res;

                    const coord = ad.add(bc.subtract(ad).scale(r)).multiply(this.diffuseFrequency);
                    const u = width * uv0.x + x;

                    const value = Math.max(0, Math.min(1, this.diffuseFunc(coord.x, coord.y, coord.z)));

                    const index = v * yStride + u * xStride;

                    data[index + 0] = Math.trunc(value * 255);
                    data[index + 1] = Math.trunc(value * 255);
                    data[index + 2] = Math.trunc(value * 255);
                    // data[index + 0] = Math.trunc(uv.x * 255);
                    // data[index + 1] = Math.trunc(uv.y * 255);
                    // data[index + 2] = 0;
                }
            }
        }

        const texture = RawTexture.CreateRGBTexture(data, width, width, scene, true, false, Texture.NEAREST_SAMPLINGMODE);

        return texture;
    }

    createMesh(name: string, subdivisions: number, scene: Scene): Mesh {
        const r = this.radius / Math.sqrt(3);

        let quads = [
            [0, 1, 2, 3],
            [5, 4, 3, 2],
            [6, 5, 2, 1],
            [7, 0, 3, 4],
            [4, 5, 6, 7],
            [7, 6, 1, 0],
        ];

        const points = [
            new Vector3(-r, -r, -r),
            new Vector3(r, -r, -r),
            new Vector3(r, r, -r),
            new Vector3(-r, r, -r),
            new Vector3(-r, r, r),
            new Vector3(r, r, r),
            new Vector3(r, -r, r),
            new Vector3(-r, -r, r),
        ];

        const vertices = quads.map((quad) => quad.map((i) => points[i])).flat();
        const blockCoords = quads.map((quad) => quad.map((i) => points[i])).flat();
        const texCoords = quads.map((_, index) => [
            new Vector2((index % 3) / 3, Math.trunc(index / 3) / 3),
            new Vector2((index % 3 + 1) / 3, Math.trunc(index / 3) / 3),
            new Vector2((index % 3 + 1) / 3, Math.trunc(index / 3 + 1) / 3),
            new Vector2((index % 3) / 3, Math.trunc(index / 3 + 1) / 3),
        ]).flat();

        quads = [
            [0, 1, 2, 3],
            [4, 5, 6, 7],
            [8, 9, 10, 11],
            [12, 13, 14, 15],
            [16, 17, 18, 19],
            [20, 21, 22, 23],
        ];

        const subdivide = (vertices: Vector3[], blockCoords: Vector3[], texCoords: Vector2[], quads: number[][]): number[][] => {
            const newQuads: number[][] = [];

            for (const [i, j, k, l] of quads) {
                const n = vertices.length;

                {
                    const a = vertices[i];
                    const b = vertices[j];
                    const c = vertices[k];
                    const d = vertices[l];

                    const ab = a.add(b).normalize().scale(this.radius);
                    const bc = b.add(c).normalize().scale(this.radius);
                    const cd = c.add(d).normalize().scale(this.radius);
                    const da = d.add(a).normalize().scale(this.radius);
                    const abcd = ab.add(cd).normalize().scale(this.radius);

                    vertices.push(abcd, ab, bc, cd, da);
                }

                {
                    const a = blockCoords[i];
                    const b = blockCoords[j];
                    const c = blockCoords[k];
                    const d = blockCoords[l];

                    const ab = a.add(b).scale(0.5);
                    const bc = b.add(c).scale(0.5);
                    const cd = c.add(d).scale(0.5);
                    const da = d.add(a).scale(0.5);
                    const abcd = ab.add(cd).scale(0.5);

                    blockCoords.push(abcd, ab, bc, cd, da);
                }

                {
                    const a = texCoords[i];
                    const b = texCoords[j];
                    const c = texCoords[k];
                    const d = texCoords[l];

                    const ab = a.add(b).scale(0.5);
                    const bc = b.add(c).scale(0.5);
                    const cd = c.add(d).scale(0.5);
                    const da = d.add(a).scale(0.5);
                    const abcd = ab.add(cd).scale(0.5);

                    texCoords.push(abcd, ab, bc, cd, da);
                }

                newQuads.push([i, n + 1, n, n + 4]);
                newQuads.push([j, n + 2, n, n + 1]);
                newQuads.push([k, n + 3, n, n + 2]);
                newQuads.push([l, n + 4, n, n + 3]);
            }

            return newQuads;
        };

        const displace = (vertices: Vector3[], blockCoords: Vector3[]) => {
            for (let i = 0; i < vertices.length; i++) {
                const coord = blockCoords[i].multiply(this.frequency);
                const height = this.heightFunc(coord.x, coord.y, coord.z);

                const normal = vertices[i].normalizeToNew();
                vertices[i].addInPlace(normal.scale(this.amplitude * height));
            }
        };

        for (let i = 0; i < subdivisions; i++) {
            quads = subdivide(vertices, blockCoords, texCoords, quads);
        }

        displace(vertices, blockCoords);

        const positions = vertices.map((v) => v.asArray()).flat();
        const indices = quads.map(([i, j, k, l]) => [i, j, k, k, l, i]).flat();
        const uvs = texCoords.map((v) => v.asArray()).flat();
        const normals: number[] = [];

        VertexData.ComputeNormals(positions, indices, normals);

        const mesh = new Mesh(name, scene);

        const vertexData = new VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.uvs = uvs;
        vertexData.normals = normals;

        vertexData.applyToMesh(mesh, true);

        mesh.convertToFlatShadedMesh();

        return mesh;
    }
}

export default Planet;