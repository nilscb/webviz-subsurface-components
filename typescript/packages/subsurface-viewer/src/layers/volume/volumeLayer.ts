// Based on this article: https://www.willusher.io/webgl/2019/01/13/volume-rendering-with-webgl/

import type { LayerProps, UpdateParameters } from "@deck.gl/core";  //  Color,
import { COORDINATE_SYSTEM, Layer, project } from "@deck.gl/core";
//import GL from "@luma.gl/constants";
import { Model, Geometry } from "@luma.gl/engine";
import fragmentShader from "./fragment.glsl";
import vertexShader from "./vertex.glsl";
import type { ExtendedLayerProps } from "../utils/layerTools";
import type { DeckGLLayerContext } from "../utils/layerTools";
import type { Device } from "@luma.gl/core";
import { getImageData } from "../utils/colormapTools";
import type { ShaderModule } from "@luma.gl/shadertools";

// Unit box with normals.
/* eslint-disable */
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
/* eslint-enable */

export interface VolumeLayerProps extends ExtendedLayerProps {
    smooth: boolean;
    propertiesData: Float32Array;
    width: number;
    height: number;
    alpha?: number;
    plane_offset?: number;
}

const defaultProps = {
    name: "VolumeLayer",
    id: "volume-layer",
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    alpha: 0.006,
    plane_offset: 1.732, // sqrt(3)
};

export default class VolumeLayer extends Layer<VolumeLayerProps> {
    initializeState(context: DeckGLLayerContext): void {
        const gl = context.device;
        this.setState(this._getModels(gl));
    }

    shouldUpdateState(): boolean {
        return true;
    }

    updateState({ context }: UpdateParameters<this>): void {
        this.setState(this._getModels(context.device));
    }

    setShaderModuleProps(
        args: Partial<{
            [x: string]: Partial<Record<string, unknown> | undefined>;
        }>
    ): void {
        super.setShaderModuleProps({
            ...args,
        });
    }

    //eslint-disable-next-line
    _getModels(device: Device) {
        const w = this.props.width;
        const h = this.props.height;
        const maxValue = Math.max(...this.props.propertiesData);
        const minValue = Math.min(...this.props.propertiesData);
        //console.log("minValue=", minValue, " maxValue=", maxValue);

        // Create 3D texture for volume data.
        const n = 128;
        const data = new Uint8Array(n * n * n);
        /* eslint-disable */
        for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++) {
            const index_cube = i * n * n + j * n + k;

            const i_data = w * (k / n);
            const j_data = h * (i / n);
            const p = this.props.propertiesData[Math.floor(j_data) * w + Math.floor(i_data)];
            const scaledP = 255 * (p - minValue) / (maxValue - minValue);
    
            //data[index_cube] = scaledP;
            data[index_cube] = data[index_cube] = p > -0.8 && p !== 0 
                                               && j > 35 && j < 65? scaledP : 0;
        }
        /* eslint-enable */

        const propertyTexture = this.context.device.createTexture({
            sampler: {
                addressModeU: "clamp-to-edge",
                addressModeV: "clamp-to-edge",
                addressModeW: "clamp-to-edge",
                minFilter: this.props.smooth ? "linear" : "nearest",
                magFilter: this.props.smooth ? "linear" : "nearest",
            },
            dimension: "3d",
            width: n,
            height: n,
            depth: n,
            format: "r8unorm", //"rgba8unorm",
            data,
        });

        // Color map texture.
        const colorMapTexture = this.context.device.createTexture({
            sampler: {
                addressModeU: "clamp-to-edge",
                addressModeV: "clamp-to-edge",
                minFilter: "linear",
                magFilter: "linear",
            },
            dimension: "3d", // both textures of same dimension or luma complains
            width: 256,
            height: 1,
            depth: 1,
            format: "rgb8unorm-webgl",
            data: getImageData({
                colormapName: "seismic", // seismic  physics rainbow
                colorTables: (this.context as DeckGLLayerContext).userData
                    .colorTables,
            }),
        });

        const bindings = { propertyTexture, colorMapTexture };

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
            bufferLayout: this.getAttributeManager()!.getBufferLayouts(),
            bindings,
            modules: [project, volumeUniforms],
            isInstanced: false,
        });

        const cameraTarget = this.context.viewport.target;
        const plane_offset = this.props.plane_offset ?? 1;
        grids.shaderInputs.setProps({
            volume: {
                cameraTarget,
                alpha: this.props.alpha,
                plane_offset,
            },
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

// local shader module for the uniforms
const volumeUniformsBlock = /*glsl*/ `\
uniform volumeUniforms {
    vec3 cameraTarget;
    float alpha;
    float plane_offset;
} volume;
`;

type VolumeUniformsType = {
    cameraTarget: [number, number, number];
    alpha: number;
    plane_offset: number;
};

// NOTE: this must exactly the same name as in the uniform block
const volumeUniforms = {
    name: "volume",
    vs: volumeUniformsBlock,
    fs: volumeUniformsBlock,
    uniformTypes: {
        cameraTarget: "vec3<f32>",
        alpha: "f32",
        plane_offset: "f32",
    },
} as const satisfies ShaderModule<LayerProps, VolumeUniformsType>;
