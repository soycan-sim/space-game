import { Color3, Material, Mesh, RawTexture, Scene, Texture, Vector2, Vector3, VertexData } from "@babylonjs/core";
import { createNoise3D, NoiseFunction3D } from "simplex-noise";

interface Target {
    position: Vector3;
}

class Lod {
    distance: number;
    subdivisions: number;

    constructor(distance: number, subdivisions: number) {
        this.distance = distance;
        this.subdivisions = subdivisions;
    }
}

export class PlanetManager {
    target: Target;
    planets: Planet[] = [];
    viewDistance: number = 10;
    surfaceLods: Lod[] = [
        new Lod(5, 9),
        new Lod(10, 8),
        new Lod(20, 7),
        new Lod(30, 6),
        new Lod(50, 5),
        new Lod(200, 4),
    ];
    lods: Lod[] = [
        new Lod(200, 4),
        new Lod(1000, 3),
        new Lod(2000, 2),
        new Lod(5000, 1),
    ];

    private epsilon: number = 1.0;
    private lastPosition?: Vector3;

    constructor(target: Target) {
        this.target = target;
    }

    tick(scene: Scene) {
        if (this.lastPosition && Vector3.DistanceSquared(this.target.position, this.lastPosition) < this.epsilon * this.epsilon) {
            return;
        }

        for (const planet of this.planets) {
            const distance = Vector3.Distance(this.target.position, planet.position);
            if (distance < planet.atmosphere) {
                planet.createSurfaceMesh(this.target.position, this.surfaceLods, scene);
            } else {
                let subdivisions;
                for (const lod of this.lods) {
                    if (distance < lod.distance) {
                        subdivisions = lod.subdivisions;
                        break;
                    }
                }

                if (subdivisions) {
                    planet.createMesh(subdivisions, scene);
                }
            }
        }

        this.lastPosition = this.target.position.clone();
    }
}

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

class Vertex {
    position: Vector3;
    edge: boolean;
    centerPiece?: boolean;
    depth: number;
    parentL?: Vertex;
    parentR?: Vertex;

    constructor(position: Vector3, edge: boolean, depth: number) {
        this.position = position;
        this.edge = edge;
        this.depth = depth;
        this.centerPiece = false;
    }

    cutSphere(other: Vertex, radius: number, edge?: boolean, centerPiece?: boolean): Vertex {
        const position = this.position.add(other.position).normalize().scaleInPlace(radius);
        let depth = Math.max(this.depth, other.depth) + 1;
        if (edge === false) {
            depth -= 1;
        }
        edge = edge ?? (this.edge && other.edge);
        const vertex = new Vertex(position, edge, depth);
        vertex.parentL = this;
        vertex.parentR = other;
        vertex.centerPiece = centerPiece ?? false;
        return vertex;
    }

    cutLinear(other: Vertex, edge?: boolean, centerPiece?: boolean): Vertex {
        const position = this.position.add(other.position).scaleInPlace(0.5);
        let depth = Math.max(this.depth, other.depth) + 1;
        if (edge === false) {
            depth -= 1;
        }
        edge = edge ?? (this.edge && other.edge);
        const vertex = new Vertex(position, edge, depth);
        vertex.parentL = this;
        vertex.parentR = other;
        vertex.centerPiece = centerPiece ?? false;
        return vertex;
    }
}

class PatchBuilder {
    planet: Planet;
    vertices: Vertex[];
    blockCoords: Vector3[];
    texCoords: Vector2[];
    quads: number[][];

    constructor(planet: Planet, vertices: Vertex[], blockCoords: Vector3[], texCoords: Vector2[], quads: number[][]) {
        this.planet = planet;
        this.vertices = vertices;
        this.blockCoords = blockCoords;
        this.texCoords = texCoords;
        this.quads = quads;
    }

    subdivide() {
        const newQuads: number[][] = [];

        for (const [i, j, k, l] of this.quads) {
            const n = this.vertices.length;

            {
                const a = this.vertices[i];
                const b = this.vertices[j];
                const c = this.vertices[k];
                const d = this.vertices[l];

                const ab = a.cutSphere(b, this.planet.radius);
                const bc = b.cutSphere(c, this.planet.radius);
                const cd = c.cutSphere(d, this.planet.radius);
                const da = d.cutSphere(a, this.planet.radius);
                const abcd = ab.cutSphere(cd, this.planet.radius, false, true);

                this.vertices.push(abcd, ab, bc, cd, da);
            }

            {
                const a = this.blockCoords[i];
                const b = this.blockCoords[j];
                const c = this.blockCoords[k];
                const d = this.blockCoords[l];

                const ab = a.add(b).scale(0.5);
                const bc = b.add(c).scale(0.5);
                const cd = c.add(d).scale(0.5);
                const da = d.add(a).scale(0.5);
                const abcd = ab.add(cd).scale(0.5);

                this.blockCoords.push(abcd, ab, bc, cd, da);
            }

            {
                const a = this.texCoords[i];
                const b = this.texCoords[j];
                const c = this.texCoords[k];
                const d = this.texCoords[l];

                const ab = a.add(b).scale(0.5);
                const bc = b.add(c).scale(0.5);
                const cd = c.add(d).scale(0.5);
                const da = d.add(a).scale(0.5);
                const abcd = ab.add(cd).scale(0.5);

                this.texCoords.push(abcd, ab, bc, cd, da);
            }

            newQuads.push([i, n + 1, n, n + 4]);
            newQuads.push([j, n + 2, n, n + 1]);
            newQuads.push([k, n + 3, n, n + 2]);
            newQuads.push([l, n + 4, n, n + 3]);
        }

        this.quads = newQuads;
    }

    subdivideSurface(target: Vector3, lods: Lod[], count: number): boolean {
        const rectDistance = (min: Vector3, max: Vector3, p: Vector3) => {
            var dx = Math.max(min.x - p.x, 0, p.x - max.x);
            var dy = Math.max(min.y - p.y, 0, p.y - max.y);
            var dz = Math.max(min.z - p.z, 0, p.z - max.z);
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        };

        const newQuads: number[][] = [];

        let subdivided = false;

        for (const [i, j, k, l] of this.quads) {
            const n = this.vertices.length;

            {
                const a = this.vertices[i];
                const b = this.vertices[j];
                const c = this.vertices[k];
                const d = this.vertices[l];

                // NOTE: only works for axis-aligned rectangles aligned (maybe?)
                const min = new Vector3(
                    Math.min(a.position.x, b.position.x, c.position.x, d.position.x),
                    Math.min(a.position.y, b.position.y, c.position.y, d.position.y),
                    Math.min(a.position.z, b.position.z, c.position.z, d.position.z),
                );
                const max = new Vector3(
                    Math.max(a.position.x, b.position.x, c.position.x, d.position.x),
                    Math.max(a.position.y, b.position.y, c.position.y, d.position.y),
                    Math.max(a.position.z, b.position.z, c.position.z, d.position.z),
                );
                const distance = rectDistance(min.addInPlace(this.planet.position), max.addInPlace(this.planet.position), target);

                let subdivisions = 0;
                for (const lod of lods) {
                    if (distance < lod.distance) {
                        subdivisions = lod.subdivisions;
                        break;
                    }
                }

                if (count >= subdivisions) {
                    newQuads.push([i, j, k, l]);
                    continue;
                }

                const ab = a.cutSphere(b, this.planet.radius);
                const bc = b.cutSphere(c, this.planet.radius);
                const cd = c.cutSphere(d, this.planet.radius);
                const da = d.cutSphere(a, this.planet.radius);
                const abcd = ab.cutSphere(cd, this.planet.radius, false, true);

                this.vertices.push(abcd, ab, bc, cd, da);
            }

            {
                const a = this.blockCoords[i];
                const b = this.blockCoords[j];
                const c = this.blockCoords[k];
                const d = this.blockCoords[l];

                const ab = a.add(b).scale(0.5);
                const bc = b.add(c).scale(0.5);
                const cd = c.add(d).scale(0.5);
                const da = d.add(a).scale(0.5);
                const abcd = ab.add(cd).scale(0.5);

                this.blockCoords.push(abcd, ab, bc, cd, da);
            }

            {
                const a = this.texCoords[i];
                const b = this.texCoords[j];
                const c = this.texCoords[k];
                const d = this.texCoords[l];

                const ab = a.add(b).scale(0.5);
                const bc = b.add(c).scale(0.5);
                const cd = c.add(d).scale(0.5);
                const da = d.add(a).scale(0.5);
                const abcd = ab.add(cd).scale(0.5);

                this.texCoords.push(abcd, ab, bc, cd, da);
            }

            subdivided = true;

            newQuads.push([i, n + 1, n, n + 4]);
            newQuads.push([j, n + 2, n, n + 1]);
            newQuads.push([k, n + 3, n, n + 2]);
            newQuads.push([l, n + 4, n, n + 3]);
        }

        if (subdivided) {
            this.quads = newQuads;
        }

        return subdivided;
    }

    displace(target?: Vector3, lods?: Lod[]) {
        for (let i = 0; i < this.vertices.length; i++) {
            const vertex = this.vertices[i];

            let height;

            if (!vertex.centerPiece && target && lods) {
                const distance = Vector3.Distance(target, vertex.position.add(this.planet.position));

                let subdivisions;
                for (const lod of lods) {
                    if (distance < lod.distance) {
                        subdivisions = lod.subdivisions;
                        break;
                    }
                }

                if (subdivisions && vertex.depth > subdivisions) {
                    const l = vertex.parentL?.position.length();
                    const r = vertex.parentR?.position.length();
                    if (!l || !r) {
                        continue;
                    }
                    height = (l + r) * 0.5 - this.planet.radius;
                }
            }

            if (!height) {
                const detail = 1 + vertex.depth / 2;
                const coord = this.blockCoords[i];
                height = this.planet.heightAt(coord, detail);
            }

            const normal = vertex.position.normalizeToNew();
            vertex.position.addInPlace(normal.scale(height));
        }
    }
}

class Planet {
    readonly name: string;
    readonly radius: number;
    readonly atmosphere: number;
    position: Vector3 = Vector3.Zero();

    private color1: Color3;
    private color2: Color3;
    private heightParams: NoiseParams;
    private textureParams: NoiseParams;

    mesh?: Mesh;
    material?: Material;

    constructor(name: string, radius: number, color1: Color3, color2: Color3, options?: { height?: NoiseParams, texture?: NoiseParams }) {
        this.name = name;
        this.radius = radius;
        this.atmosphere = radius * 1.5;

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

    createMesh(subdivisions: number, scene: Scene): Mesh {
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

        const patches = quads.map((indices, index) => {
            const vertices = indices.map((i) => new Vertex(points[i].clone(), true, 0));
            const blockCoords = indices.map((i) => points[i].clone());
            const texCoords = [
                new Vector2((index % 3) / 3, Math.trunc(index / 3) / 3),
                new Vector2((index % 3 + 1) / 3, Math.trunc(index / 3) / 3),
                new Vector2((index % 3 + 1) / 3, Math.trunc(index / 3 + 1) / 3),
                new Vector2((index % 3) / 3, Math.trunc(index / 3 + 1) / 3),
            ];
            const patch = new PatchBuilder(this, vertices, blockCoords, texCoords, [[0, 1, 2, 3]]);
            return patch;
        });

        for (const patch of patches) {
            for (let i = 0; i < subdivisions; i++) {
                patch.subdivide();
            }

            patch.displace();
        }

        const positions: number[] = [];
        const indices: number[] = [];
        const uvs: number[] = [];

        let offset = 0;

        for (const patch of patches) {
            patch.vertices.forEach((vertex) => positions.push(...vertex.position.asArray()));
            patch.texCoords.forEach((uv) => uvs.push(...uv.asArray()));
            patch.quads.forEach(([i, j, k, l]) => {
                i += offset;
                j += offset;
                k += offset;
                l += offset;
                indices.push(i, j, k, k, l, i);
            });

            offset += patch.vertices.length;
        }

        const normals: number[] = [];

        VertexData.ComputeNormals(positions, indices, normals);

        if (!this.mesh) {
            this.mesh = new Mesh(this.name, scene);
        }

        const vertexData = new VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.uvs = uvs;
        vertexData.normals = normals;

        vertexData.applyToMesh(this.mesh, true);

        this.mesh.convertToFlatShadedMesh();
        this.mesh.position = this.position;
        if (this.material) {
            this.mesh.material = this.material;
        }

        return this.mesh;
    }

    createSurfaceMesh(target: Vector3, lods: Lod[], scene: Scene): Mesh {
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

        const patches = quads.map((indices, index) => {
            const vertices = indices.map((i) => new Vertex(points[i].clone(), true, 0));
            const blockCoords = indices.map((i) => points[i].clone());
            const texCoords = [
                new Vector2((index % 3) / 3, Math.trunc(index / 3) / 3),
                new Vector2((index % 3 + 1) / 3, Math.trunc(index / 3) / 3),
                new Vector2((index % 3 + 1) / 3, Math.trunc(index / 3 + 1) / 3),
                new Vector2((index % 3) / 3, Math.trunc(index / 3 + 1) / 3),
            ];
            const patch = new PatchBuilder(this, vertices, blockCoords, texCoords, [[0, 1, 2, 3]]);
            return patch;
        });

        for (const patch of patches) {
            let subdivisions = 0;
            let subdivide = true;
            while (subdivide) {
                subdivide = patch.subdivideSurface(target, lods, subdivisions);
                subdivisions += 1;
            }

            patch.displace(target, lods);
        }

        const positions: number[] = [];
        const indices: number[] = [];
        const uvs: number[] = [];

        let offset = 0;

        for (const patch of patches) {
            patch.vertices.forEach((vertex) => positions.push(...vertex.position.asArray()));
            patch.texCoords.forEach((uv) => uvs.push(...uv.asArray()));
            patch.quads.forEach(([i, j, k, l]) => {
                i += offset;
                j += offset;
                k += offset;
                l += offset;
                indices.push(i, j, k, k, l, i);
            });

            offset += patch.vertices.length;
        }

        const normals: number[] = [];

        VertexData.ComputeNormals(positions, indices, normals);

        if (!this.mesh) {
            this.mesh = new Mesh(this.name, scene);
        }

        const vertexData = new VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.uvs = uvs;
        vertexData.normals = normals;

        vertexData.applyToMesh(this.mesh, true);

        this.mesh.convertToFlatShadedMesh();
        this.mesh.position = this.position;
        if (this.material) {
            this.mesh.material = this.material;
        }

        return this.mesh;
    }
}

export default Planet;