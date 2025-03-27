import type {
    Color,
    //LayerContext,
    LayerProps,
    PickingInfo,
    UpdateParameters,
} from "@deck.gl/core";
import { COORDINATE_SYSTEM } from "@deck.gl/core";
import {luma} from '@luma.gl/core';
import GL from "@luma.gl/constants";
import type { Device, UniformValue } from "@luma.gl/core";
//import { Geometry, Model } from "@luma.gl/engine";
import { localPhongLighting, utilities } from "../shader_modules";
import type {
    ExtendedLayerProps,
    LayerPickInfo,
    PropertyDataType,
    ColorMapFunctionType,
} from "../utils/layerTools";
import { createPropertyData, getImageData } from "../utils/layerTools";
import type { DeckGLLayerContext } from "../../components/Map";
import fs from "./fragment.fs.glsl";
//import fsLineShader from "./fragment_lines.glsl";
import vs from "./vertex.glsl";
//import vsLineShader from "./vertex_lines.glsl";
import { ShaderModule } from "@luma.gl/shadertools";

import {Layer, project32, picking, DefaultProps, log, LayerContext, Material} from '@deck.gl/core';
import {SamplerProps, Texture} from '@luma.gl/core';
import {Model, Geometry} from '@luma.gl/engine';
import {ParsedPBRMaterial} from '@luma.gl/gltf';
import {phongMaterial} from '@luma.gl/shadertools';



/////////////////////////////////////////////////////////////
const customBlock = /*glsl*/ `\
uniform customUniforms {
    bool isContoursDepth;
    float contourReferencePoint;
    float contourInterval;

    float valueRangeMin;
    float valueRangeMax;
    float colorMapRangeMin;
    float colorMapRangeMax;

    vec3 colorMapClampColor;
    bool isClampColor;
    bool isColorMapClampColorTransparent;
    bool smoothShading;
    bool ZIncreasingDownwards;
} custom;
`;

type customType = {
    // isContoursDepth: boolean;
    // contourReferencePoint: number;
    // contourInterval: number;
    // valueRangeMin: number;
    // valueRangeMax: number;
    // colorMapRangeMin: number;
    // colorMapRangeMax: number;
    // colorMapClampColor: [number, number, number];
    // isClampColor: boolean;
    // isColorMapClampColorTransparent: boolean;
    // smoothShading: boolean;
    // ZIncreasingDownwards: boolean;
};

// NOTE: this must exactly the same name as in the uniform block
const custom = {
    name: "custom",
    vs: customBlock, //undefined, //customBlock, //pointsUniformsBlock,
    fs: customBlock, //undefined,
    uniformTypes: {
        // isContoursDepth: "u32",
        // contourReferencePoint: "f32",
        // contourInterval: "f32",
        // valueRangeMin: "f32",
        // valueRangeMax: "f32",
        // colorMapRangeMin: "f32",
        // colorMapRangeMax: "f32",
        // colorMapClampColor: "vec3<f32>",
        // isClampColor: "u32",
        // isColorMapClampColorTransparent: "u32",
        // smoothShading: "u32",
        // ZIncreasingDownwards: "u32",
    },
} as const satisfies ShaderModule<LayerProps, customType>;
////////////////////////////////////////////////////////////////////////////


export type Material =
    | {
          ambient: number;
          diffuse: number;
          shininess: number;
          specularColor: [number, number, number];
      }
    | boolean;
export interface PrivateMapLayerProps extends ExtendedLayerProps {
    positions: Float32Array;
    normals: Float32Array;
    triangleIndices: Uint32Array;
    vertexProperties: Float32Array;
    vertexIndices: Int32Array;
    lineIndices: Uint32Array;
    contours: [number, number];
    gridLines: boolean;
    isContoursDepth: boolean;
    colorMapName: string;
    colorMapRange: [number, number];
    colorMapClampColor: Color | undefined | boolean;
    colorMapFunction?: ColorMapFunctionType;
    propertyValueRange: [number, number];
    smoothShading: boolean;
    depthTest: boolean;
    ZIncreasingDownwards: boolean;
}

const defaultProps = {
    data: ["dummy"],
    contours: [-1, -1],
    isContoursDepth: true,
    gridLines: false,
    colorMapName: "",
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    propertyValueRange: [0.0, 1.0],
    meshValueRange: [0.0, 1.0],
    depthTest: true,
    ZIncreasingDownwards: true,
};

// This is a private layer used only by the composite MapLayer
export default class PrivateMapLayer extends Layer<PrivateMapLayerProps> {
    get isLoaded(): boolean {
        return (this.state["isLoaded"] as boolean) ?? false;
    }

    initializeState(context: DeckGLLayerContext): void {
        const gl = context.device;
        const [mesh_model] = this._getModels(gl);
        this.setState({
            models: [mesh_model],
            isLoaded: false,
        });
    }

    shouldUpdateState({
        props,
        oldProps,
        context,
        changeFlags,
    }: UpdateParameters<this>): boolean {
        return (
            super.shouldUpdateState({
                props,
                oldProps,
                context,
                changeFlags,
            }) || changeFlags.propsOrDataChanged
        );
    }

    updateState({ context }: UpdateParameters<this>): void {
        this.initializeState(context as DeckGLLayerContext);
    }

    _getModels(device: Device) {
        const colormap: Texture = device.createTexture({
            sampler: {
                addressModeU: "clamp-to-edge",
                addressModeV: "clamp-to-edge",
                minFilter: "linear",
                magFilter: "linear",
            },
            width: 256,
            height: 1,
            format: "rgb8unorm-webgl",
            data: getImageData(
                this.props.colorMapName,
                (this.context as DeckGLLayerContext).userData.colorTables,
                this.props.colorMapFunction
            ),
        });

        // MESH MODEL
        const contourReferencePoint = this.props.contours[0] ?? -1.0;
        const contourInterval = this.props.contours[1] ?? -1.0;
        const isContoursDepth = this.props.isContoursDepth;

        const valueRangeMin = this.props.propertyValueRange[0] ?? 0.0;
        const valueRangeMax = this.props.propertyValueRange[1] ?? 1.0;

        // If specified color map will extend from colorMapRangeMin to colorMapRangeMax.
        // Otherwise it will extend from valueRangeMin to valueRangeMax.
        const colorMapRangeMin = this.props.colorMapRange?.[0] ?? valueRangeMin;
        const colorMapRangeMax = this.props.colorMapRange?.[1] ?? valueRangeMax;

        const isClampColor: boolean =
            this.props.colorMapClampColor !== undefined &&
            this.props.colorMapClampColor !== true &&
            this.props.colorMapClampColor !== false;
        let colorMapClampColor = isClampColor
            ? this.props.colorMapClampColor
            : [0, 0, 0];

        // Normalize to [0,1] range.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        colorMapClampColor = (colorMapClampColor as Color).map(
            (x) => (x ?? 0) / 255
        );

        const isColorMapClampColorTransparent: boolean =
            (this.props.c as boolean) === false;

        const smoothShading =
            this.props.normals.length == 0 ? false : this.props.smoothShading;

        let mesh_model = new Model(this.context.device, {
            id: `${this.props.id}-mesh`,
            ...this.getShaders(),
            geometry: new Geometry({
                topology: "triangle-list",
                attributes: {
                    positions: { value: this.props.positions, size: 3 },
                    // Only add normals if they are defined.
                    // ...(this.props.normals.length > 0 && {
                    //     normals: { value: this.props.normals, size: 3 },
                    // }),
                    //properties: { value: this.props.vertexProperties, size: 1 },
                },
                indices: { value: this.props.triangleIndices, size: 1 },
            }),
            bufferLayout: this.getAttributeManager()!.getBufferLayouts(),
            //uniforms: {
            //     contourReferencePoint,
            //     contourInterval,
            //     isContoursDepth,
            //     valueRangeMin,
            //     valueRangeMax,
            //     colorMapRangeMin,
            //     colorMapRangeMax,
            //     colorMapClampColor,
            //     isColorMapClampColorTransparent,
            //     isClampColor,
            //     smoothShading,
            //     ZIncreasingDownwards: this.props.ZIncreasingDownwards,
            //},
            // bindings: {
            //     colormap: colormap,
            // },
            isInstanced: false,
        });
        //Model.props.debugShaders: 'always';
        //luma.set("debug-webgl", true);
        // mesh_model.shaderInputs.setProps({
        //     //debug: "always",
        //     custom: {
        //         // contourReferencePoint,
        //         // contourInterval,
        //         // isContoursDepth,
        //         // valueRangeMin,
        //         // valueRangeMax,
        //         // colorMapRangeMin,
        //         // colorMapRangeMax,
        //         // colorMapClampColor,
        //         // isColorMapClampColorTransparent,
        //         // isClampColor,
        //         // smoothShading,
        //         // ZIncreasingDownwards: this.props.ZIncreasingDownwards,
        //     },
        // });

        //console.log(mesh_model.shaderInputs.getModules(), this.getShaders())

        // MESH LINES
        // const mesh_lines_model = new Model(device, {
        //     id: `${this.props.id}-lines`,
        //     vs: vsLineShader,
        //     fs: fsLineShader,
        //     geometry: new Geometry({
        //         topology: "line-list",
        //         attributes: {
        //             positions: { value: this.props.positions, size: 3 },
        //         },
        //         indices: { value: this.props.lineIndices, size: 1 },
        //     }),
        //     bufferLayout: this.getAttributeManager()!.getBufferLayouts(),
        //     modules: [project32],
        //     isInstanced: false,
        // });

        // return [mesh_model, mesh_lines_model];
        return [mesh_model];
    }

    draw(args: {
        moduleParameters?: unknown;
        uniforms: UniformValue;
        context: LayerContext;
    }): void {
        if (!this.state["models"]) {
            return;
        }

        const { context } = args;
        const { gl } = context;

        const [mesh_model] = this.state["models"] as Model[];

        gl.enable(gl.POLYGON_OFFSET_FILL);
        if (!this.props.depthTest) {
            gl.disable(gl.DEPTH_TEST);
        }

        gl.polygonOffset(1, 1);
        mesh_model.draw(context.renderPass);
        gl.disable(gl.POLYGON_OFFSET_FILL);

        if (!this.props.depthTest) {
            gl.enable(gl.DEPTH_TEST);
        }

        // if (this.props.gridLines) {
        //     mesh_lines_model.setUniforms({
        //         uniforms,
        //         ZIncreasingDownwards: this.props.ZIncreasingDownwards,
        //     });
        //     mesh_lines_model.draw(context.renderPass);
        // }

        if (!this.state["isLoaded"]) {
            this.setState({ ...this.state, isLoaded: true });
        }
    }

    decodePickingColor(): number {
        return 0;
    }

    getPickingInfo({ info }: { info: PickingInfo }): LayerPickInfo {
        if (!info.color) {
            return info;
        }

        const layer_properties: PropertyDataType[] = [];

        // Note these colors are in the  0-255 range.
        const r = info.color[0];
        const g = info.color[1];
        const b = info.color[2];

        const vertexIndex = 256 * 256 * r + 256 * g + b;

        if (typeof info.coordinate?.[2] !== "undefined") {
            const zScale = this.props.modelMatrix
                ? this.props.modelMatrix[10]
                : 1;

            const depth =
                (this.props.ZIncreasingDownwards
                    ? -info.coordinate[2]
                    : info.coordinate[2]) / Math.max(0.001, zScale);

            layer_properties.push(createPropertyData("Depth", depth));
        }

        const properties = this.props.vertexProperties;
        const property = properties[vertexIndex];
        layer_properties.push(createPropertyData("Property", property));

        return {
            ...info,
            properties: layer_properties,
        };
    }

    getShaders() {
        //console.log(this.context.defaultShaderModules)
        return super.getShaders({
            vs,
            fs,
            modules: [
                // this.context.defaultShaderModules[0],
                // Layer,
                project32,
                phongMaterial,
                picking,
                utilities,
                localPhongLighting,
                custom,
            ],
        });
    }

    // getShaders() {
    //     //const superShaders = super.getShaders({});
    //     const superShaders = super.getShaders({
    //         vs,
    //         fs,
    //         modules: [project32, picking, localPhongLighting, utilities, custom],
    //     });
    //     //return {...superShaders,  modules: [project32, picking, utilities, points],}
    //     const superShaders_modules = [...superShaders.modules];
    //     console.log(superShaders_modules)
    //     // use object.assign to make sure we don't overwrite existing fields like `vs`, `modules`...
    //     return Object.assign({}, superShaders, {
    //         vs,
    //         fs,
    //         modules: superShaders.modules, 
    //     });
    // }

    // getShaders() {
    //     const superShaders = super.getShaders({
    //         vs,
    //         fs,
    //         modules: [project32, picking, localPhongLighting, utilities, custom],
    //     });
    //     //console.log(superShaders)
    //     // use object.assign to make sure we don't overwrite existing fields like `vs`, `modules`...
    //     return Object.assign({}, superShaders, {
    //         vs,
    //         fs,
    //         modules: [...superShaders.modules, project32, picking, localPhongLighting, utilities, custom], // localPhongLighting
    //     });
    // }
}

PrivateMapLayer.layerName = "privateMapLayer";
PrivateMapLayer.defaultProps = defaultProps;
