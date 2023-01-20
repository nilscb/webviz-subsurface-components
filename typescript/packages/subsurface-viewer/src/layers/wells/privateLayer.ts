import {
    COORDINATE_SYSTEM,
    Layer,
    picking,
    project,
    phongLighting,
    PickingInfo,
    UpdateParameters,
    Color,
} from "@deck.gl/core/typed";
import {
    createPropertyData,
    LayerPickInfo,
    PropertyDataType,
} from "../utils/layerTools";
import { Model, Geometry } from "@luma.gl/engine";
import { DeckGLLayerContext } from "../../components/Map";
import { ExtendedLayerProps, colorMapFunctionType } from "../utils/layerTools";
import vsShader from "./vertex.glsl";
import fsShader from "./fragment.fs.glsl";
import vsLineShader from "./vertex_lines.glsl";
import fsLineShader from "./fragment_lines.glsl";

import { colorTablesArray, rgbValues } from "@emerson-eps/color-tables/";
import { createDefaultContinuousColorScale } from "@emerson-eps/color-tables/dist/component/Utils/legendCommonFunction";
import { Texture2D } from "@luma.gl/webgl";
import GL from "@luma.gl/constants";

import { Vector3, Matrix3 } from "@math.gl/core";

import vertexShader from "./vertex.glsl";
import fragmentShader from "./fragment.glsl";

const DEFAULT_TEXTURE_PARAMETERS = {
    [GL.TEXTURE_MIN_FILTER]: GL.LINEAR_MIPMAP_LINEAR,
    [GL.TEXTURE_MAG_FILTER]: GL.LINEAR,
    [GL.TEXTURE_WRAP_S]: GL.CLAMP_TO_EDGE,
    [GL.TEXTURE_WRAP_T]: GL.CLAMP_TO_EDGE,
};

export interface privateLayerProps<D> extends ExtendedLayerProps<D> {
    wellStrings: number[][];
    depthTest: boolean;
}

const defaultProps = {
    wellStrings: [],
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    depthTest: true,
};

function mylength(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function getRadii() {
    return 15;
    return 15 + Math.random() * 30;
    return 10 + Math.random() * 30;
}

function getCircle(p1: Vector3, p2: Vector3, circle: Array<number>, radii): void {
    const npoints = circle.length / 3; // no pints around the circle

    // Construct orthonormal coordinate system on p1 as nx, ny, nz vectors
    const nz = p2.clone().subtract(p1).normalize(); // XXX enheltsvector fra p1 til p2

    // ny initially a vector not parallell to nz. see: https://math.stackexchange.com/questions/3122010/how-to-deterministically-pick-a-vector-that-is-guaranteed-to-be-non-parallel-to
    const isZUp = nz[2] < -0.5 || nz[2] > 0.5;
    const ny = isZUp ? new Vector3(0, 1, 0) : new Vector3(-nz[2], nz[0], nz[2]);
    ny.cross(nz).normalize(); // ny er naa perpendicular til nz og normalisert...
    const nx = ny.clone().cross(nz); // nx, ny nz er naa orthonormale


    // Disse to kan holdes konstant over sirkelen
    const P = new Matrix3([nx[0], ny[0], nz[0],    // eslint-disable-line
                           nx[1], ny[1], nz[1],    // eslint-disable-line
                           nx[2], ny[2], nz[2] ]); // eslint-disable-line
    P.transpose(); //  XXX lag kommentar her.. noe med row major for,m eller noe.. den lagres anderledes enn jeg oppga den over..
    const Pinv = P.clone().invert();

    // Make a circle of points around p1.
    const da = 360 / (npoints - 1);
    const v0 = nx.clone(); //.scale(200); // Det er denne som skal roteres

    for (let k = 0; k < npoints; k++) {
        const deg = k * da;
        const a = deg * 0.017453;
        // Note: sin og cos kan forhandsregnes.
        const cosa = Math.cos(a);
        const sina = Math.sin(a);
         // XXX det virker jo men hvorfor stemmer det med colomn major etc ref matrisen P
        const A = new Matrix3( [ cosa, -sina,  0,    // eslint-disable-line
                                 sina,  cosa,  0,    // eslint-disable-line
                                 0,        0,  1 ]); // eslint-disable-line
        A.multiplyRight(Pinv);
        const PAPinv = P.clone().multiplyRight(A);

        const v = new Vector3([ PAPinv[0] * v0[0] + PAPinv[1] * v0[1] + PAPinv[2] * v0[2],    // eslint-disable-line
                                PAPinv[3] * v0[0] + PAPinv[4] * v0[1] + PAPinv[5] * v0[2],    // eslint-disable-line
                                PAPinv[6] * v0[0] + PAPinv[7] * v0[1] + PAPinv[8] * v0[2] ]); // eslint-disable-line
        v.scale(radii); // Radius
        v.add(p1);

        circle[k * 3 + 0] = v[0];
        circle[k * 3 + 1] = v[1];
        circle[k * 3 + 2] = v[2];
    }
}

// This is a private layer used only by the composite Map3DLayer
export default class privateLayer extends Layer<privateLayerProps<unknown>> {

    initializeState(context: DeckGLLayerContext): void {
        const { gl } = context;
        this.setState(this.getModel(gl, this.props.wellStrings));
    }

    //eslint-disable-next-line
    getModel(gl: any, wellStrings: number[][]) {
        const vertexs: number[] = [];
        const colors: number[] = [];

        const c1 = [1, 0, 0];
        const c2 = [0, 1, 0];
        const c3 = [0, 0, 1];
        const c4 = [1, 1, 0];
        const c5 = [0, 1, 1];
        const c6 = [1, 0, 1];

        const colors_array = [c1, c2, c3, c4, c5, c6];

        const no_wells = wellStrings.length;

        const nn = 30; // number of points around circle
        const current_circle = Array<number>(nn * 3);
        const next_circle = Array<number>(nn * 3);

        // Triangles
        for (let well_no = 0; well_no < no_wells; well_no++) {  // no_wells 6
            const w = wellStrings[well_no].flat();

            const nvertexs = w.length / 3;

            // const radii = 30 + Math.random() * 30;

            // XXX bare continue her om det ikke er nok punkter..!!!
            const col = colors_array[well_no % colors_array.length];


            // Make a circle of points around point.
            const p1 = new Vector3([w[0], w[1], w[2]]);
            const p2 = new Vector3([w[3], w[4], w[5]]);
            const p3 = new Vector3([w[6], w[7], w[8]]);
            const radii = 20 + (well_no) * 1;  // getRadii();
            getCircle(p1, p2, current_circle, radii);
            getCircle(p2, p3, next_circle, radii);

            for (let i = 1; i < nvertexs - 2; i++) { // Note: start and end index.
            //for (let i = 1; i < 3; i++) {

                for (let j = 0; j < nn - 1; j++) {
                    const x1 = current_circle[j * 3 + 0];
                    const y1 = current_circle[j * 3 + 1];
                    const z1 = current_circle[j * 3 + 2];

                    const x2 = current_circle[(j + 1) * 3 + 0];
                    const y2 = current_circle[(j + 1) * 3 + 1];
                    const z2 = current_circle[(j + 1) * 3 + 2];

                    const x3 = next_circle[j * 3 + 0];
                    const y3 = next_circle[j * 3 + 1];
                    const z3 = next_circle[j * 3 + 2];

                    const x4 = next_circle[(j + 1) * 3 + 0];
                    const y4 = next_circle[(j + 1) * 3 + 1];
                    const z4 = next_circle[(j + 1) * 3 + 2];

                    // t1
                    vertexs.push(x1, y1, z1);
                    colors.push(...col);

                    vertexs.push(x2, y2, z2);
                    colors.push(...col);

                    vertexs.push(x3, y3, z3);
                    colors.push(...col);

                    // t2
                    vertexs.push(x3, y3, z3);
                    colors.push(...col);

                    vertexs.push(x2, y2, z2);
                    colors.push(...col);

                    vertexs.push(x4, y4, z4);
                    colors.push(...col);
                }

                const p1 = new Vector3([w[i * 3 + 0], w[i * 3 + 1], w[i * 3 + 2]]);
                const p2 = new Vector3([w[(i + 1) * 3 + 0], w[(i + 1) * 3 + 1], w[(i + 1) * 3 + 2]]);
                const p3 = new Vector3([w[(i + 2) * 3 + 0], w[(i + 2) * 3 + 1], w[(i + 2) * 3 + 2]]);

                //const radii = getRadii();
                getCircle(p1, p2, current_circle, radii);
                getCircle(p2, p3, next_circle, radii);
            }
        }

        // XXX note bruk heller indeks
        const model = new Model(gl, {
            id: `${this.props.id}-pie`,
            vs: vertexShader,
            fs: fragmentShader,
            geometry: new Geometry({
                drawMode: GL.TRIANGLES,  //GL.TRIANGLES, LINES
                attributes: {
                    positions: { value: new Float32Array(vertexs), size: 3 },
                    colors: { value: new Float32Array(colors), size: 3 },
                },
                vertexCount: vertexs.length / 3,
            }),

            modules: [project, picking, phongLighting],
            isInstanced: false, // This only works when set to false.
        });

        return { model };
    }

    // Signature from the base class, eslint doesn't like the any type.
    // eslint-disable-next-line
    draw(args: any): void {
        if (!this.state["model"]) {
            console.log("WHAT");
            return;
        }

        const model = this.state["model"];
        model.draw();
    }

    decodePickingColor(): number {
        return 0;
    }
}

privateLayer.layerName = "privateLayer";
privateLayer.defaultProps = defaultProps;
