// Based on this article: https://www.willusher.io/webgl/2019/01/13/volume-rendering-with-webgl/

import type { UpdateParameters } from "@deck.gl/core";  //  Color,
import { COORDINATE_SYSTEM, Layer, project } from "@deck.gl/core";
//import GL from "@luma.gl/constants";
import { Model, Geometry } from "@luma.gl/engine";
import fragmentShader from "./fragment.glsl";
import vertexShader from "./vertex.glsl";
import type { ExtendedLayerProps } from "../utils/layerTools";

import type { DeckGLLayerContext } from "../utils/layerTools";

import type { Device } from "@luma.gl/core";

// Unit box. 
const s = 1;
const unit_box = new Float32Array([
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


//lines = lines.map(x => x - 0.5);

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
    //lines: [-100, -100, 0, 100, 100, 100],
    //color: [0, 0, 0, 1],
};

export default class VolumeLayer extends Layer<VolumeLayerProps> {
    initializeState(context: DeckGLLayerContext): void {
        const gl = context.device;
        this.setState(this._getModels(gl));
    }

    shouldUpdateState(): boolean {
        return false;
    }

    updateState({ context }: UpdateParameters<this>): void {
        //const { gl } = context;
        this.setState(this._getModels(context.device));
    }

    setShaderModuleProps(
        args: Partial<{
            [x: string]: Partial<Record<string, unknown> | undefined>;
        }>
    ): void {
        // XXX det er noe som heter compressed texture i luma.gl som kanskje kan brukes her..
        // const property = 100; // [0.255]
        // const val = Math.floor(Math.random() * 256);
        // console.log("VolumeLayer: Creating 3D texture with val=", val);
        // https://luma.gl/docs/api-reference/core/resources/texture
        const n = 100;
        const data = new Uint8Array(n * n * n);
        for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++) {
            const index = i * n * n + j * n + k;
            // data[index] = Math.floor(Math.random() * 256);
            // Create a sphere in the volume
            const cx = n / 2;
            const cy = n / 2;
            const cz = n / 2;
            const radius = n / 2.5;
            const dist = Math.sqrt((i - cx) * (i - cx) + (j - cy) * (j - cy) + (k - cz) * (k - cz));
            if (dist < radius) {
                data[index] = 255;
            } else {
                data[index] = 0;
            }
            //data[index] = 200;
        }
        const myTexture = this.context.device.createTexture({
            sampler: {
                addressModeU: "clamp-to-edge",
                addressModeV: "clamp-to-edge",
                addressModeW: "clamp-to-edge",
                minFilter: "nearest", //"linear",  // XXX change bak later...
                magFilter: "nearest", //"linear",
            },
            dimension: "3d",
            width: n,
            height: n,
            depth: n,

            //ormat: "rgba8unorm",
            //data: new Uint8Array([240, 1, 255, 1]),

            format: "r8unorm", //"rgba8unorm",
            data, // new Uint8Array([255]),
        });



        this.state.model?.setBindings({ myTexture: myTexture });

        super.setShaderModuleProps({
            ...args,
        });
    }

    //eslint-disable-next-line
    _getModels(device: Device) {   //context: DeckGLLayerContext) {
        const color = [0.5, 0.5, 0.5, 0.5];
        const grids = new Model(device, {
            id: `${this.props.id}-grids`,
            vs: vertexShader,
            fs: fragmentShader,
            uniforms: { uColor: color },
            geometry: new Geometry({
                topology: "triangle-list",
                attributes: {
                    positions: { value: unit_box, size: 3 },
                    normals: { value: normals, size: 3 }, // Trengs for backface culling ellers blir fargene doblet.
                },
                vertexCount: unit_box.length / 3,
            }),
            modules: [project],
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
