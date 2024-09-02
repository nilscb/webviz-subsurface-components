// Based on this article: https://www.willusher.io/webgl/2019/01/13/volume-rendering-with-webgl/

import type { UpdateParameters } from "@deck.gl/core";  //  Color,
import { COORDINATE_SYSTEM, Layer, project } from "@deck.gl/core";
//import GL from "@luma.gl/constants";
import { Model, Geometry } from "@luma.gl/engine";
import fragmentShader from "./fragment.glsl";
import vertexShader from "./vertex.glsl";
import type { DeckGLLayerContext } from "../../components/Map";
import type { ExtendedLayerProps } from "../utils/layerTools";

const s = 1.0; //1.2;
let lines = new Float32Array([
    0, 0, 0,  s, 0, 0,  0, s, 0,  // bot Z
    s, 0, 0,  s, s, 0,  0, s, 0,

    0, 0, s,  s, 0, s,  0, s, s,  // top
    s, 0, s,  s, s, s,  0, s, s,


    0, 0, 0,   0, s, 0,  0, 0, s,  // left X
    0, s, 0,   0, s, s,  0, 0, s,

    s, 0, 0,   s, s, 0,  s, 0, s,  // right
    s, s, 0,   s, s, s,  s, 0, s,


    0, 0, 0,   s, 0, 0,  s, 0, s,  // front Y
    0, 0, 0,   0, 0, s,  s, 0, s,

    0, s, 0,   s, s, 0,  s, s, s,  // back
    0, s, 0,   0, s, s,  s, s, s,
]);

lines = lines.map(x => x - 0.5);

const normals = new Float32Array([
    0, 0, -1, 0, 0, -1 ,0, 0, -1,  // bot
    0, 0, -1, 0, 0, -1 ,0, 0, -1,

    0, 0, 1,  0, 0, 1,  0, 0, 1,  // top
    0, 0, 1,  0, 0, 1,  0, 0, 1,


    -1, 0, 0, -1, 0, 0, -1, 0, 0,  // left
    -1, 0, 0, -1, 0, 0, -1, 0, 0,

    1, 0, 0, 1, 0, 0, 1, 0, 0,  // right
    1, 0, 0, 1, 0, 0, 1, 0, 0,


    0, -1, 0,  0, -1, 0,  0, -1, 0,  // front
    0, -1, 0,  0, -1, 0,  0, -1, 0,

    0, 1, 0,  0, 1, 0,  0, 1, 0,  // back
    0, 1, 0,  0, 1, 0,  0, 1, 0,
]);

export interface VolumeLayerProps extends ExtendedLayerProps {
    //lines: number[]; // from pt , to pt.
    //color: Color;
}

const defaultProps = {
    name: "VolumeLayer",
    id: "volume-layer",
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    lines: [-100, -100, 0, 100, 100, 100],
    //color: [0, 0, 0, 1],
};

export default class VolumeLayer extends Layer<VolumeLayerProps> {
    initializeState(context: DeckGLLayerContext): void {
        const { gl } = context;
        this.setState(this._getModels(gl));
    }

    shouldUpdateState(): boolean {
        return true;
    }

    updateState({ context }: UpdateParameters<this>): void {
        //const { gl } = context;
        this.setState(this._getModels(context));
    }

    //eslint-disable-next-line
    _getModels(context: DeckGLLayerContext) {
        const color = [0.5, 0.5, 0.5, 0.5];
        const grids = new Model(context.device, {
            id: `${this.props.id}-grids`,
            vs: vertexShader,
            fs: fragmentShader,
            uniforms: { uColor: color },
            geometry: new Geometry({
                //drawMode: GL.TRIANGLES,
                topology: "triangle-list",
                attributes: {
                    positions: { value: lines, size: 3 },
                    normals: { value: normals, size: 3 },
                },
                vertexCount: lines.length / 3,
            }),
            modules: [project],  //  modules: [project32, picking, localPhongLighting, utilities],  project
            isInstanced: false,
        });

        return {
            model: grids,
            models: [grids].filter(Boolean),
            modelsByName: { grids },
        };
    }
}

VolumeLayer.layerName = "VolumeLayer";
VolumeLayer.defaultProps = defaultProps;
