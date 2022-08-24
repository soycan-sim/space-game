import { Color3, Mesh, RawTexture, Scene, Texture, Vector2, Vector3, VertexData } from "@babylonjs/core";
import { createNoise3D, NoiseFunction3D } from "simplex-noise";

export class NoiseParams {
    func: NoiseFunction3D;
    allowNegative: boolean = true;
    offset: number = 0.0;
    amplitude: number = 1.0;
    frequency: Vector3 = Vector3.One();
    octaveScale: number = 2.0;
    octaveAmplitude: number = 0.8;

    constructor() {
        this.func = createNoise3D();
    }

    sample3D(coord: Vector3, detail: number): number {
        let result = this.offset;

        let amplitude = this.amplitude;
        coord.multiplyInPlace(this.frequency);

        for (let i = 0; i < detail; i++) {
            let value = this.func(coord.x, coord.y, coord.z);
            if (!this.allowNegative) {
                value = value * 0.5 + 0.5;
            }
            result += value * amplitude;

            amplitude *= this.octaveAmplitude;
            coord.scaleInPlace(this.octaveScale);
        }

        return result;
    }

};

class Planet {
    readonly radius: number;

    private color1: Color3;
    private color2: Color3;
    private heightParams: NoiseParams;
    private textureParams: NoiseParams;

    constructor(radius: number, color1: Color3, color2: Color3, options?: { height?: NoiseParams, texture?: NoiseParams }) {
        this.radius = radius;

        this.color1 = color1.toHSV();
        this.color2 = color2.toHSV();
        if (options?.height) {
            this.heightParams = options.height;
        } else {
            this.heightParams = new NoiseParams();
            this.heightParams.amplitude = radius * 0.01;
        }
        if (options?.texture) {
            this.textureParams = options.texture;
        } else {
            this.textureParams = new NoiseParams();
            this.textureParams.allowNegative = false;
        }
    }

    heightAt(coord: Vector3, detail: number): number {
        return this.heightParams.sample3D(coord, detail);
    }

    colorAt(coord: Vector3, detail: number): Color3 {
        const value = Math.max(0, Math.min(1, this.textureParams.sample3D(coord, detail)));
        const hsv = this.color1.add(this.color2.subtract(this.color1).scale(value));
        return Color3.FromHSV(hsv.r, hsv.g, hsv.b);
    }

    createTexture(name: string, res: number, detail: number, scene: Scene): RawTexture {
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

                    const coord = ad.add(bc.subtract(ad).scale(r));
                    const u = width * uv0.x + x;

                    const color = this.colorAt(coord, detail);

                    const index = v * yStride + u * xStride;

                    data[index + 0] = Math.trunc(color.r * 255);
                    data[index + 1] = Math.trunc(color.g * 255);
                    data[index + 2] = Math.trunc(color.b * 255);
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

        const vertices = quads.map((quad) => quad.map((i) => points[i].clone())).flat();
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
                const coord = blockCoords[i];
                const height = this.heightAt(coord, 1 + subdivisions / 2)

                const normal = vertices[i].normalizeToNew();
                vertices[i].addInPlace(normal.scale(height));
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