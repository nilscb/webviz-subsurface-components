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

function makeBox(
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
    zMin: number,
    zMax: number
): Float32Array {
    const xScale = xMax - xMin;
    const yScale = yMax - yMin;
    const zScale = zMax - zMin;

    const box = new Float32Array(unit_box.length);
    for (let i = 0; i < unit_box.length; i += 3) {
        box[i + 0] = unit_box[i + 0] * xScale + xMin;
        box[i + 1] = unit_box[i + 1] * yScale + yMin;
        box[i + 2] = unit_box[i + 2] * zScale + zMin;
    }
    return box;
}

/* eslint-enable */

export interface VolumeLayerProps extends ExtendedLayerProps {
    smooth: boolean;
    propertiesData: Float32Array;
    ni: number;
    nj: number;
    nk: number;

    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;

    alpha?: number;
    plane_offset?: number;
}

const defaultProps = {
    name: "VolumeLayer",
    id: "volume-layer",
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    alpha: 0.006,
    plane_offset: 1.732, // sqrt(3)

    xMin: 0,
    xMax: 1,
    yMin: 0,
    yMax: 1,
    zMin: 0,
    zMax: 1,
};

export default class VolumeLayer extends Layer<VolumeLayerProps> {
    get isLoaded(): boolean {
        //const isLoaded = super.isLoaded && typeof this.state === "defined" && Object.keys(this.state).length > 0;
        //console.log("VolumeLayer isLoaded=", super.isLoaded,  Object.keys(this.state ?? {}).length > 0);
        return true; //isLoaded;
    }

    initializeState(context: DeckGLLayerContext): void {
        const gl = context.device;
        this.setState(this._getModels(gl));
    }

    shouldUpdateState(): boolean {
        //console.log("state", this.state);
        //return Object.keys(this.state ?? {}).length === 0;
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
        const ni = this.props.ni;
        const nj = this.props.nj;
        const nk = this.props.nk;
        const maxValue = this.props.propertiesData.reduce((a, b) => Math.max(a, b), -Infinity);
        const minValue = this.props.propertiesData.reduce((a, b) => Math.min(a, b), Infinity);
        //console.log("minValue=", minValue, " maxValue=", maxValue);
        //minValue= -11589.6484375 13943.7744140625

        //console.log("VolumeLayer: ni=", ni, " nj=", nj, " nk=", nk);


        /* eslint-disable */
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
            width: ni,  // x axis ??
            height: nj, // y axis
            depth: nk, //nk,  // z axis
            format: "r32float", //  r8unorm "rgba8unorm",
            data: this.props.propertiesData,
        });

        // Color map texture.
        const colorMapTexture = this.context.device.createTexture({
            sampler: {
                addressModeU: "clamp-to-edge",
                addressModeV: "clamp-to-edge",
                minFilter: "linear",  // nearest linear
                magFilter: "linear",
            },
            dimension: "3d", // both textures of same dimension or luma complains
            width: 256,
            height: 1,
            depth: 1,
            format: "rgb8unorm-webgl",
            data: getImageData({
                colormapName: "seismic", // seismic  physics rainbow Seismic YRGBC
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
                xMin: this.props.xMin,
                xMax: this.props.xMax,
                yMin: this.props.yMin,
                yMax: this.props.yMax,
                zMin: this.props.zMin,
                zMax: this.props.zMax,

                minValue,
                maxValue,
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
    float xMin;
    float xMax;
    float yMin;
    float yMax;
    float zMin;
    float zMax;
    float minValue;
    float maxValue;
} volume;
`;

type VolumeUniformsType = {
    cameraTarget: [number, number, number];
    alpha: number;
    plane_offset: number;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
    minValue: number;
    maxValue: number;
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
        xMin: "f32",
        xMax: "f32",
        yMin: "f32",
        yMax: "f32",
        zMin: "f32",
        zMax: "f32",
        minValue: "f32",
        maxValue: "f32",
    },
} as const satisfies ShaderModule<LayerProps, VolumeUniformsType>;
