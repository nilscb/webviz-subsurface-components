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

import vertexShader from "./tube_vertex.glsl";
import fragmentShader from "./tube_fragment.glsl";

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

export interface TubeLayerProps extends ExtendedLayerProps {
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
    return 10;
    return 15 + Math.random() * 30;
    return 10 + Math.random() * 30;
}

function getCircle(p1: Vector3, p2: Vector3, p3: Vector3, circle: Array<number>, radii): void {
    const npoints = circle.length / 3; // number of  points around the circle

    const v1 = p1.clone().subtract(p2).normalize();
    const v2 = p3.clone().subtract(p2).normalize();

    // Construct orthonormal coordinate system blabla ...
    const nx = v1.clone().add(v2).normalize(); // bisector vector
    const ny = v1.clone().cross(v2).normalize();
    const nz = nx.clone().cross(ny);


    // Disse to kan holdes konstant over sirkelen
    const P = new Matrix3([nx[0], ny[0], nz[0],    // eslint-disable-line
                           nx[1], ny[1], nz[1],    // eslint-disable-line
                           nx[2], ny[2], nz[2] ]); // eslint-disable-line
    P.transpose(); //  XXX lag kommentar her.. noe med row major for,m eller noe.. den lagres anderledes enn jeg oppga den over..
    const Pinv = P.clone().invert(); // XX trengs clone her?

    // Make a circle of points around p1.
    const da = 360 / (npoints);
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


export default class tubeLayer extends Layer<TubeLayerProps> {

     setShaderModuleProps(
        args: Partial<{
            [x: string]: Partial<Record<string, unknown> | undefined>;
        }>
    ): void {
        super.setShaderModuleProps({
            ...args,
            lighting: {
                ...args["lighting"],
                enabled: true, //true, //this.props.enableLighting,
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
        const vertexs: number[] = [];
        for (let i = 0; i < points.length; i++) {
            vertexs.push(points[i]);
        }
        vertexs.push(points[0], points[1], points[2]); // close the circle

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
        const myColors = getImageData(
            (this.context as DeckGLLayerContext).userData.colorTables
        );

        const c1 = [1, 0, 0];
        const c2 = [0, 1, 0];
        const c3 = [0, 0, 1];
        const c4 = [1, 1, 0];
        const c5 = [0, 1, 1];
        const c6 = [1, 0, 1];

        const colors_array = [c1, c2, c3, c4, c5, c6];

        const no_wells = wellStrings.length;

        const no_circle_pts = 20; // number of points around circle

        // Loop wells.
        const models_wells = [];
        const models_circles = [];

        for (let well_no = 0; well_no < no_wells; well_no++) {  // no_wells = 20
        //for (let well_no = 16; well_no < 18; well_no++) {
            const min_indexes: number[] = [];
            const current_circle = Array<number>(no_circle_pts * 3);

            const w = wellStrings[well_no].flat();

            const nvertexs = w.length / 3;

            let col = colors_array[well_no % colors_array.length];
            //const radii = 100; //getRadii() + well_no * 1;  // 30 + Math.random() * 30;
            const radii = 50 + well_no * 1;  // 30 + Math.random() * 30;

            const vertexs = new Float32Array(nvertexs * no_circle_pts * 3);
            const indexs: number[] = []; // XX preallocate??
            const colors: number[] = [];
            const myMds: number[] = [];

            // Create circles along the well path.
            const n = nvertexs;
            let ncircles = 0;
            for (let i = 0; i < n - 2; i++) {
                const p1 = new Vector3([w[(i + 0) * 3 + 0], w[(i + 0) * 3 + 1], w[(i + 0) * 3 + 2]]); // eslint-disable-line
                const p2 = new Vector3([w[(i + 1) * 3 + 0], w[(i + 1) * 3 + 1], w[(i + 1) * 3 + 2]]); // eslint-disable-line
                const p3 = new Vector3([w[(i + 2) * 3 + 0], w[(i + 2) * 3 + 1], w[(i + 2) * 3 + 2]]); // eslint-disable-line

                getCircle(p1, p2, p3, current_circle, radii);
                ncircles++;
                let min_x = 9999999;
                let min_index = -1;
                for (let c = 0; c < no_circle_pts; c++) {
                    const idx = (i * no_circle_pts + c) * 3;
                    const x = current_circle[c * 3 + 0];
                    vertexs[idx + 0] = x;
                    vertexs[idx + 1] = current_circle[c * 3 + 1];
                    vertexs[idx + 2] = current_circle[c * 3 + 2];

                    //col = colors_array[Math.floor(Math.random() * colors_array.length)];
                    colors.push(...col); // cols og mds må være pr vertex!!
                    myMds.push( c % 2);


                    if (x < min_x) {
                        min_x = x;
                        min_index = c;
                    }
                }
                min_indexes.push(min_index);
                // XXX models_circles.push(this.makeCircleModel(context, current_circle));
            }

            // Connect circles with triangles.
            for (let i = 0; i < ncircles - 1; i++) { // XXX -1 skal vel fjernes her når jeg fikser sirkler over hele
                const upper_index = min_indexes[i]; // index of point with smallest x in upper circle
                const lower_index = min_indexes[i + 1]; // index of point with smallest x in lower circle

                //console.log("upper_index, lower_index: ", upper_index, lower_index);

                for (let j = 0; j < no_circle_pts; j++) {
                    const i_upper = (upper_index + j) % no_circle_pts;
                    const i_lower = (lower_index + j) % no_circle_pts;

                    //console.log("i_upper, i_lower: ", i_upper, i_lower);

                    let p1, p2, p3, p4;

                    // upper circle indexes
                    p1 = i * no_circle_pts + i_upper;
                    p2 = (i_upper < no_circle_pts - 1 ? p1 + 1 : i * no_circle_pts);
                    //console.log("p1, p2: ", p1, p2);

                    // lower circle indexes
                    p3 = (i + 1) * no_circle_pts + i_lower;
                    p4 = (i_lower < no_circle_pts - 1 ? p3 + 1 : (i + 1) * no_circle_pts);
                    //console.log("p3 p4: ", i_lower, p3, p4);

                    // t1
                    indexs.push(p1);
                    indexs.push(p2);
                    indexs.push(p3);

                    // t2
                    indexs.push(p3);
                    indexs.push(p2);
                    indexs.push(p4);
                }
            }

            // Create Model for the well tube.
            const model_well_tube = new Model(context.device, {
                id: "tube model",
                vs: vertexShader,
                fs: fragmentShader,
                geometry: new Geometry({
                    topology: "triangle-list",  // "line-strip",   'line-strip' 'line-list'  triangle-list  https://luma.gl/docs/api-reference/core/resources/render-pipeline#primitivetopology
                    attributes: {
                        positions: { value: new Float32Array(vertexs), size: 3 },  // XXX trenger vel ikke kopi på disse...
                        colors: { value: new Float32Array(colors), size: 3 }, // XXX må være like mange som vertexes??
                        myMds: { value: new Float32Array(myMds), size: 1 },
                    },
                    indices: { value: new Uint32Array(indexs), size: 1 },
                    vertexCount: indexs.length, //vertexs.length / 3,
                }),

                modules: [project, picking, lighting, phongMaterial],
                //isInstanced: false, // This only works when set to false.
            });
            model_well_tube.setUniforms({
                //myColors: { value: new Float32Array(myColors), size: 3 },
                myColors,
            });

            models_wells.push(model_well_tube);
        } // end wells loop

  

        return [...models_wells] // XXX , ...models_circles];
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

        for (let i = 0; i < models.length; i++) {
            models[i].draw(args.context.renderPass);
        }

        // // tube
        // models[0].draw(args.context.renderPass);

        // // circles (for debug)
        // for (let i = 1; i < models.length; i++) {
        //     models[i].draw(args.context.renderPass);
        // }
    }

    // decodePickingColor(): number {
    //     return 0;
    // }
}

tubeLayer.layerName = "tubeLayer";
tubeLayer.defaultProps = defaultProps;
