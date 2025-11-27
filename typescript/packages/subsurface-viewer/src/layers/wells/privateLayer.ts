import {
    COORDINATE_SYSTEM,
    Layer,
    picking,
    project,
    phongLighting,
    LayerContext,
    project32,

    // PickingInfo,
    // UpdateParameters,
    // Color,
} from "@deck.gl/core";
import { phongMaterial } from "../shader_modules/phong-lighting/phong-material";
import { lighting } from "@luma.gl/shadertools";
// //from "@deck.gl/core/typed";
// // import {
// //     createPropertyData,
// //     LayerPickInfo,
// //     PropertyDataType,
// // } from "../utils/layerTools";
import { Model, Geometry } from "@luma.gl/engine";
import type { UniformValue } from "@luma.gl/core";
import type {
    DeckGLLayerContext,
    ExtendedLayerProps,
    // LayerPickInfo,
    // PropertyDataType,
} from "../utils/layerTools";

// //import { colorMapFunctionType } from "../utils/layerTools";
// import vsShader from "./vertex.glsl";
// import fsShader from "./fragment.fs.glsl";
// import vsLineShader from "./vertex_lines.glsl";
// import fsLineShader from "./fragment_lines.glsl";

import type { colorTablesArray } from "@emerson-eps/color-tables/";
import { rgbValues } from "@emerson-eps/color-tables/";
import { createDefaultContinuousColorScale } from "@emerson-eps/color-tables/dist/component/Utils/legendCommonFunction";
// //import { Texture2D } from "@luma.gl/webgl";

// //import { GL } from "@luma.gl/constants";

import { Vector3, Matrix3 } from "@math.gl/core";

import vertexShader from "./vertex.glsl";
import fragmentShader from "./fragment.glsl";

import vertexShaderLine from "./line.vs.glsl";
import fragmentShaderLine from "./line.fs.glsl";

// // function shuffle(array) {
// //     let currentIndex = array.length;

// //     // While there remain elements to shuffle...
// //     while (currentIndex != 0) {
// //         // Pick a remaining element...
// //         const randomIndex = Math.floor(Math.random() * currentIndex);
// //         currentIndex--;

// //         // And swap it with the current element.
// //         [array[currentIndex], array[randomIndex]] = [
// //             array[randomIndex],
// //             array[currentIndex],
// //         ];
// //     }
// // }

function getImageData(colorTables: colorTablesArray) {
    const defaultColorMap = createDefaultContinuousColorScale;
    let colorMap = defaultColorMap();

    colorMap = (value: number) => rgbValues(value, "Physics", colorTables);

    //const data = new Uint8Array(256 * 3);
    const data = new Float32Array(256 * 3);

    for (let i = 0; i < 256; i++) {
        const value = i / 255.0;
        const color = colorMap ? colorMap(value) : [0, 0, 0];
        if (color) {
            data[3 * i + 0] = color[0] / 255;
            data[3 * i + 1] = color[1] / 255;
            data[3 * i + 2] = color[2] / 255;
        }
    }

    return data ? data : [0, 0, 0];
}


// // const DEFAULT_TEXTURE_PARAMETERS = {
// //     [GL.TEXTURE_MIN_FILTER]: GL.LINEAR_MIPMAP_LINEAR,
// //     [GL.TEXTURE_MAG_FILTER]: GL.LINEAR,
// //     [GL.TEXTURE_WRAP_S]: GL.CLAMP_TO_EDGE,
// //     [GL.TEXTURE_WRAP_T]: GL.CLAMP_TO_EDGE,
// // };

export interface PrivateLayerProps extends ExtendedLayerProps {
    wellStrings: number[][];
    depthTest: boolean;
}

const defaultProps = {
    wellStrings: [],
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    depthTest: true,
};

// // function mylength(v) {
// //     return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
// // }

function getRadii() {
    return 50;
    return 15 + Math.random() * 30;
    return 10 + Math.random() * 30;
}

function getCircle(p1: Vector3, p2: Vector3, p3: Vector3, circle: Array<number>, radii): void {
    const npoints = circle.length / 3; // number of  points around the circle

    const v1 = p1.clone().subtract(p2).normalize();
    const v2 = p3.clone().subtract(p2).normalize();

    // Construct orthonormal coordinate system blabla ...
    const nx = v1.clone().add(v2).normalize(); // bisector vector
    const ny = v1.clone().cross(v2);
    const nz = nx.clone().cross(ny);


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
        v.add(p2);

        circle[k * 3 + 0] = v[0];
        circle[k * 3 + 1] = v[1];
        circle[k * 3 + 2] = v[2];
    }
}


export default class privateLayer extends Layer<PrivateLayerProps> {

     setShaderModuleProps(
        args: Partial<{
            [x: string]: Partial<Record<string, unknown> | undefined>;
        }>
    ): void {
        super.setShaderModuleProps({
            ...args,
            lighting: {
                ...args["lighting"],
                enabled: true, //this.props.enableLighting,
            },
        });
    }


    initializeState(context: DeckGLLayerContext): void {
        // const [model_mesh, mesh_lines_model] = this._getModels(context);
        // this.setState({
        //     models: [model_mesh, mesh_lines_model],
        //     isLoaded: false,
        // });

        const m = this._getModels(context, this.props.wellStrings);
        this.setState({
            models: m,
        });
    }

    makeCircleModel(context: DeckGLLayerContext, points: number[]): Model {
        const vertexs: number[] = []
        for (let i = 0; i < points.length; i++) {
            vertexs.push(points[i]);
        }

        const model = new Model(context.device, {
            id: "circle model",
            vs: vertexShaderLine,
            fs: fragmentShaderLine,
            geometry: new Geometry({
                topology: "line-strip", // line-strip' 'line-list'  triangle-list  https://luma.gl/docs/api-reference/core/resources/render-pipeline#primitivetopology
                attributes: {
                    positions: { value: new Float32Array(vertexs), size: 3 },
                },
                vertexCount: vertexs.length / 3,
            }),

            modules: [project],
        });
        return model;
    }

    //eslint-disable-next-line
    _getModels(context: DeckGLLayerContext, wellStrings: number[][]) {
        const models_circles = [];

        const myColors = getImageData(
            (this.context as DeckGLLayerContext).userData.colorTables
        );
//         //shuffle(myColors); // XXX
//         //console.log("myColors", myColors)

        const vertexs: number[] = [];
        const colors: number[] = [];
        const myMds: number[] = [];

        const c1 = [1, 0, 0];
        const c2 = [0, 1, 0];
        const c3 = [0, 0, 1];
        const c4 = [1, 1, 0];
        const c5 = [0, 1, 1];
        const c6 = [1, 0, 1];

        const colors_array = [c1, c2, c3, c4, c5, c6];

        const no_wells = wellStrings.length;

        const nn = 7; // number of points around circle
        const current_circle = Array<number>(nn * 3);
        const next_circle = Array<number>(nn * 3);

        // Triangles
        for (let well_no = 0; well_no < no_wells; well_no++) {  // no_wells 6
            const w = wellStrings[well_no].flat();

            const nvertexs = w.length / 3;

                        console.log("nvertexs", nvertexs);

            // const radii = 30 + Math.random() * 30;

            // XXX bare continue her om det ikke er nok punkter..!!!
            const col = colors_array[well_no % colors_array.length];

            // Make a circle of points around point.
            // const p1 = new Vector3([w[0], w[1], w[2]]);
            // const p2 = new Vector3([w[3], w[4], w[5]]);
            // const p3 = new Vector3([w[6], w[7], w[8]]);
            const radii = getRadii() + well_no * 1;

            //getCircle(p1, p2, p3, current_circle, radii);
            //models_circles.push(this.makeCircleModel(context, current_circle));
            //getCircle(p2, p3, next_circle, radii);

            const n = nvertexs; //w.length; // nvertexs ??
            for (let i = 0; i < n - 2; i++) { // Note: start and end index  
                //console.log("i", i);  //her er det noe galt får bare to ringer

                const p1 = new Vector3([w[(i + 0) * 3 + 0], w[(i + 0) * 3 + 1], w[(i + 0) * 3 + 2]]); // eslint-disable-line
                const p2 = new Vector3([w[(i + 1) * 3 + 0], w[(i + 1) * 3 + 1], w[(i + 1) * 3 + 2]]); // eslint-disable-line
                const p3 = new Vector3([w[(i + 2) * 3 + 0], w[(i + 2) * 3 + 1], w[(i + 2) * 3 + 2]]); // eslint-disable-line


                getCircle(p1, p2, p3, current_circle, radii);
                models_circles.push(this.makeCircleModel(context, current_circle));

                // for (let j = 0; j < nn - 1; j++) {
                //     const x1 = current_circle[j * 3 + 0];
                //     const y1 = current_circle[j * 3 + 1];
                //     const z1 = current_circle[j * 3 + 2];

                //     const x2 = current_circle[(j + 1) * 3 + 0];
                //     const y2 = current_circle[(j + 1) * 3 + 1];
                //     const z2 = current_circle[(j + 1) * 3 + 2];

                //     const x3 = next_circle[j * 3 + 0];
                //     const y3 = next_circle[j * 3 + 1];
                //     const z3 = next_circle[j * 3 + 2];

                //     const x4 = next_circle[(j + 1) * 3 + 0];
                //     const y4 = next_circle[(j + 1) * 3 + 1];
                //     const z4 = next_circle[(j + 1) * 3 + 2];

                //     // t1
                //     vertexs.push(x1, y1, z1);
                //     colors.push(...col);
                //     myMds.push(0);

                //     vertexs.push(x2, y2, z2);
                //     colors.push(...col);
                //     myMds.push(0);

                //     vertexs.push(x3, y3, z3);
                //     colors.push(...col);
                //     myMds.push(1);

                //     // t2
                //     vertexs.push(x3, y3, z3);
                //     colors.push(...col);
                //     myMds.push(1);

                //     vertexs.push(x2, y2, z2);
                //     colors.push(...col);
                //     myMds.push(0);

                //     vertexs.push(x4, y4, z4);
                //     colors.push(...col);
                //     myMds.push(1);
                // }

                // const p1 = new Vector3([w[i * 3 + 0], w[i * 3 + 1], w[i * 3 + 2]]);
                // const p2 = new Vector3([w[(i + 1) * 3 + 0], w[(i + 1) * 3 + 1], w[(i + 1) * 3 + 2]]);
                // const p3 = new Vector3([w[(i + 2) * 3 + 0], w[(i + 2) * 3 + 1], w[(i + 2) * 3 + 2]]);


                // getCircle(p1, p2, p3, current_circle, radii);
                // models_circles.push(this.makeCircleModel(context, current_circle));

                //getCircle(p2, p3, next_circle, radii);
            }
        }

        // XXX note bruk heller indeks
        const model = new Model(context.device, {
            id: "tube model",
            vs: vertexShader,
            fs: fragmentShader,
            geometry: new Geometry({
                topology: "triangle-list",
                attributes: {
                    positions: { value: new Float32Array(vertexs), size: 3 },  // XXX trenger vel ikke kopi på disse...
                    colors: { value: new Float32Array(colors), size: 3 },
                    myMds: { value: new Float32Array(myMds), size: 1 },
                },
                vertexCount: vertexs.length / 3,
            }),

            modules: [project, picking, lighting, phongMaterial],
            //isInstanced: false, // This only works when set to false.
        });
        model.setUniforms({
            //myColors: { value: new Float32Array(myColors), size: 3 },
            myColors,
        });

        return [model, ...models_circles];
        //return { model };
    }

    // Signature from the base class, eslint doesn't like the any type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    draw(args: {
        moduleParameters?: unknown;
        uniforms: UniformValue;
        context: LayerContext;
    }): void {
        //const { gl } = args.context;

        const models = this.state["models"] as Model[];

        // tube
        //models[0].draw(args.context.renderPass);

        // circles (for debug)
        for (let i = 1; i < models.length; i++) {
            models[i].draw(args.context.renderPass);
        }
    }

    // decodePickingColor(): number {
    //     return 0;
    // }
}

privateLayer.layerName = "privateLayer";
privateLayer.defaultProps = defaultProps;
