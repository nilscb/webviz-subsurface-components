import type { Color, UpdateParameters } from "@deck.gl/core/typed";
import { COORDINATE_SYSTEM, Layer, project32 } from "@deck.gl/core/typed";
import GL from "@luma.gl/constants";
import { Model, Geometry } from "@luma.gl/engine";
import fragmentShader from "./fragment.glsl";
import vertexShader from "./vertex.glsl";
import type { DeckGLLayerContext } from "../../components/Map";
import type { ExtendedLayerProps } from "../utils/layerTools";


const lines = new Float32Array([0, 0, 0,  1, 0, 0,  0, 1, 0]);
const normals = new Float32Array([0, 0, -1, 0, 0, -1 ,0, 0, -1]);

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
        const { gl } = context;
        this.setState(this._getModels(gl));
    }

    //eslint-disable-next-line
    _getModels(gl: any) {
        const color = [0, 0, 0, 1];
        const grids = new Model(gl, {
            id: `${this.props.id}-grids`,
            vs: vertexShader,
            fs: fragmentShader,
            uniforms: { uColor: color },
            geometry: new Geometry({
                drawMode: GL.TRIANGLES,
                attributes: {
                    positions: { value: lines, size: 3 },
                    normals: { value: normals, size: 3 },
                },
                vertexCount: lines.length / 3,
            }),
            modules: [project32],  //  modules: [project32, picking, localPhongLighting, utilities],
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
