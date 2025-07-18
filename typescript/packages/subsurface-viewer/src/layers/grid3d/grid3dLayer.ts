import { isEqual } from "lodash";
import type React from "react";

import { CompositeLayer } from "@deck.gl/core";

import workerpool from "workerpool";

import type { Material } from "../gpglLayers/typeDefs";
import PrivateLayer from "./privateGrid3dLayer";
import { makeFullMesh } from "./webworker";

import type {
    ExtendedLayerProps,
    ReportBoundingBoxAction,
} from "../utils/layerTools";
import type { ColormapFunctionType } from "../utils/colormapTools";

import config from "../../SubsurfaceConfig.json";

import type { BoundingBox3D, Color, RGBColor } from "../../utils";
import { findConfig, loadDataArray } from "../../utils";

// init workerpool
const workerPoolConfig = findConfig(
    config,
    "config/workerpool",
    "config/layer/Grid3DLayer/workerpool"
);

const pool = workerpool.pool({
    ...{
        maxWorkers: 10,
        workerType: "web",
    },
    ...workerPoolConfig,
});

function onTerminateWorker() {
    const stats = pool.stats();
    if (stats.busyWorkers === 0 && stats.pendingTasks === 0) {
        pool.terminate();
    }
}

export type WebWorkerParams = {
    points: Float32Array;
    polys: Uint32Array;
    properties: Float32Array | Uint16Array | undefined;
    undefinedValue: number;
};

function GetBBox(points: Float32Array): BoundingBox3D {
    let xmax = -99999999;
    let ymax = -99999999;
    let zmax = -99999999;

    let xmin = 99999999;
    let ymin = 99999999;
    let zmin = 99999999;

    for (let i = 0; i < points.length / 3; i++) {
        xmax = points[3 * i + 0] > xmax ? points[3 * i + 0] : xmax;
        xmin = points[3 * i + 0] < xmin ? points[3 * i + 0] : xmin;

        ymax = points[3 * i + 1] > ymax ? points[3 * i + 1] : ymax;
        ymin = points[3 * i + 1] < ymin ? points[3 * i + 1] : ymin;

        zmax = points[3 * i + 2] > zmax ? points[3 * i + 2] : zmax;
        zmin = points[3 * i + 2] < zmin ? points[3 * i + 2] : zmin;
    }
    return [xmin, ymin, zmin, xmax, ymax, zmax];
}

type TTypedArray = Float32Array | Uint32Array | Uint16Array;

async function loadData<T extends TTypedArray>(
    data: string | number[] | TTypedArray,
    type: { new (data: unknown): T }
): Promise<T> {
    const result = await loadDataArray(data, type);
    if (result !== null) {
        return result;
    }
    return Promise.reject("Grid3DLayer: Unsupported type of input data");
}

async function loadPropertiesData(
    propertiesData: string | number[] | Float32Array | Uint16Array
): Promise<Float32Array | Uint16Array> {
    const isPropertiesDiscrete = propertiesData instanceof Uint16Array;
    const result = isPropertiesDiscrete
        ? await loadDataArray(propertiesData, Uint16Array)
        : await loadDataArray(propertiesData, Float32Array);
    if (result !== null) {
        return result;
    }
    return Promise.reject("Grid3DLayer: Unsupported type of input data");
}

async function load_data(
    pointsData: string | number[] | Float32Array,
    polysData: string | number[] | Uint32Array,
    propertiesData: string | number[] | Float32Array | Uint16Array | undefined,
    loadProperties: boolean
): Promise<
    [Float32Array, Uint32Array, Float32Array | Uint16Array | undefined]
> {
    const points = await loadData(pointsData, Float32Array);
    const polys = await loadData(polysData, Uint32Array);

    const properties =
        loadProperties && propertiesData
            ? await loadPropertiesData(propertiesData)
            : undefined;
    return Promise.all([points, polys, properties]);
}

/**
 * Enumerates possible coloring modes of Grid3D Layer.
 */
export enum TGrid3DColoringMode {
    /** A continuous property is provided to colorize the cells. */
    Property,
    /** A discrete property is provided to colorize the cells. */
    DiscreteProperty,
    /** Coloring using the X value of the cell nodes. */
    X,
    /** Coloring using the Y value of the cell nodes. */
    Y,
    /** Coloring using the Z value of the cell nodes. */
    Z,
}

/**
 * Returns true if the coloring mode is geometric, that is based on the X, Y or Z coordinates
 * of the cell nodes. In that case no explicit property data is required.
 * @param coloringMode coloring mode.
 * @returns true if the coloring mode is geometric.
 */
export function isGeometricProperty(
    coloringMode: TGrid3DColoringMode
): boolean {
    return (
        coloringMode === TGrid3DColoringMode.X ||
        coloringMode === TGrid3DColoringMode.Y ||
        coloringMode === TGrid3DColoringMode.Z
    );
}

/**
 * Returns true if the coloring mode is discrete. In that case an explicit property data is required,
 * with integer values ranging from 0 to N, where N is the number of discrete property values.
 * @param coloringMode coloring mode
 * @returns true if the property values are discrete.
 */
export function isDiscreteProperty(coloringMode: TGrid3DColoringMode): boolean {
    return coloringMode === TGrid3DColoringMode.DiscreteProperty;
}

export interface IDiscretePropertyValueName {
    value: number;
    name: string;
}

export interface Grid3DLayerProps extends ExtendedLayerProps {
    /**  Url, or native, or typed javascript array. Set of points.
     * [x1, y1, z1, x2, y2, z2, ...]
     */
    pointsData: string | number[] | Float32Array;

    /**  Url, or native, or typed javascript array.
     * For each polygon ["number of points in poly", p1, , p2 ... ]
     * Example of two polygons: the first polygon with 4 points and the second one with 3 points.
     * [4, 3, 1, 9, 77, 3, 6, 44, 23]
     */
    polysData: string | number[] | Uint32Array;

    /**  Url, or native, or typed javascript array.
     *  A scalar property for each polygon.
     * [0.23, 0.11. 0.98, ...]
     * If propertiesData is provided as Uint16Array it is assumed that all the values are in range [0, N].
     * If colorMapFunction is Uint8Array the property values are used as color indices.
     */
    propertiesData: string | number[] | Float32Array | Uint16Array | undefined;

    /**
     * Discrete property value-name pairs to be displayed in cursor readouts.
     * The property values are used as the array indices.
     */
    discretePropertyValueNames?: IDiscretePropertyValueName[];

    /**
     * Defines how the cells are to be colored:
     * by property value or by a coordinate.
     */
    coloringMode?: TGrid3DColoringMode;

    /**  Name of color map. E.g "PORO"
     */
    colorMapName: string;

    /**  Use color map in this range.
     */
    colorMapRange?: [number, number];

    /** Clamp colormap to this color at ends.
     *   Given as array of three values (r,g,b) e.g: [255, 0, 0]
     *   If not set or set to true, it will clamp to color map min and max values.
     *   If set to false the clamp color will be completely transparent.
     */
    colorMapClampColor: Color | undefined | boolean;

    /**  Optional function property.
     * If defined this function will override the color map.
     * Takes a value in the range [0,1] and returns a color.
     * E.g. (x) => [x * 255, x * 255, x * 255]
     * May also be set as constant color:
     * E.g. [255, 0, 0] for constant red cells.
     * Can be defined as Uint8Array containing [R, G, B] triplets in [0, 255] range each.
     */
    colorMapFunction?: ColormapFunctionType | Uint8Array;

    /**
     * Value in propertiesData indicating that the property is undefined.
     * When propertiesData is Uint16Array the value is index in discretePropertyValueNames if provided.
     * By default, it is assumed to be NaN for Float32 properties data and 0xFFFF for UInt16.
     * Note: in case of floating point properties exact comparison is performed so use the same
     * constant value both in propertiesData array and as undefinedPropertyValue.
     */
    undefinedPropertyValue?: number;

    /**
     * Color for the cells with undefined property value.
     * Is not overridden by and used prior to colorMapFunction.
     * By default, Light gray if not provided.
     */
    undefinedPropertyColor?: RGBColor;

    /** Enable lines around cell faces.
     *  default: true.
     */
    gridLines: boolean;

    /** Surface material properties.
     * material: true  = default material, coloring depends on surface orientation and lighting.
     *           false = no material,  coloring is independent on surface orientation and lighting.
     *           or full spec:
     *      material: {
     *           ambient: 0.35,
     *           diffuse: 0.6,
     *           shininess: 32,
     *           specularColor: [255, 255, 255],
     *       }
     */
    material: Material;

    /** Enable/disable depth testing when rendering layer. Default true.
     */
    depthTest: boolean;

    /** If true means that input z values are interpreted as depths.
     *   For example depth of z = 1000 corresponds to -1000 on the z axis. Default true.
     */
    ZIncreasingDownwards: boolean;

    // Non public properties:
    reportBoundingBox?: React.Dispatch<ReportBoundingBoxAction>;
}

const defaultProps = {
    "@@type": "Grid3DLayer",
    name: "Grid 3D",
    id: "grid-3d-layer",
    visible: true,
    material: true,
    coloringMode: TGrid3DColoringMode.Property,
    colorMapName: "",
    gridLines: true,
    propertyValueRange: [0.0, 1.0],
    depthTest: true,
    ZIncreasingDownwards: true,
};

export default class Grid3DLayer extends CompositeLayer<Grid3DLayerProps> {
    get isLoaded(): boolean {
        const subLayers = this.getSubLayers();
        const isLoaded =
            super.isLoaded &&
            subLayers.length > 0 &&
            subLayers.every((layer) => layer.isLoaded);

        const isFinished =
            (this.state?.["isFinishedLoading"] as boolean) ?? false;
        return isLoaded && isFinished;
    }

    rebuildData(reportBoundingBox: boolean): void {
        const p = load_data(
            this.props.pointsData,
            this.props.polysData,
            this.props.propertiesData,
            !isGeometricProperty(
                this.props.coloringMode ?? TGrid3DColoringMode.Property
            )
        );

        p.then(([points, polys, properties]) => {
            const bbox = GetBBox(points);

            // Using inline web worker for calculating the triangle mesh from
            // loaded input data so not to halt the GUI thread.

            const webworkerParams: WebWorkerParams = {
                points,
                polys,
                properties,
                undefinedValue: this.getUndefinedPropertyValue(),
            };

            pool.exec(makeFullMesh, [{ data: webworkerParams }]).then((e) => {
                const [mesh, mesh_lines, propertyValueRange] = e;
                const legend = {
                    discrete: false,
                    valueRange: this.props.colorMapRange ?? propertyValueRange,
                    colorName: this.props.colorMapName,
                    title: "MapLayer",
                    colormapFunction: this.props.colorMapFunction,
                };

                this.setState({
                    mesh,
                    mesh_lines,
                    propertyValueRange,
                    legend,
                    bbox,
                });

                if (
                    typeof this.props.reportBoundingBox !== "undefined" &&
                    reportBoundingBox
                ) {
                    this.props.reportBoundingBox({ layerBoundingBox: bbox });
                }

                this.setState({
                    ...this.state,
                    isFinishedLoading: true,
                });

                onTerminateWorker();
            });
        });
    }

    initializeState(): void {
        this.setState({
            ...this.state,
            isFinishedLoading: false,
        });
        const reportBoundingBox = true;
        this.rebuildData(reportBoundingBox);
    }

    updateState({
        props,
        oldProps,
    }: {
        props: Grid3DLayerProps;
        oldProps: Grid3DLayerProps;
    }): void {
        const needs_reload =
            !isEqual(props.pointsData, oldProps.pointsData) ||
            !isEqual(props.polysData, oldProps.polysData) ||
            !isEqual(props.propertiesData, oldProps.propertiesData) ||
            !isEqual(props.gridLines, oldProps.gridLines) ||
            !isEqual(props.ZIncreasingDownwards, oldProps.ZIncreasingDownwards);

        if (needs_reload) {
            this.setState({
                ...this.state,
                isFinishedLoading: false,
            });
            const reportBoundingBox = false;
            this.rebuildData(reportBoundingBox);
        }
    }

    renderLayers(): [PrivateLayer?] {
        if (Object.keys(this.state).length === 1) {
            // isFinishedLoading only in state
            return [];
        }
        const undefinedColor = this.getUndefinedPropertyColor();
        const undefinedValue = this.getUndefinedPropertyValue();

        const enableLighting: boolean = !(this.props.material === false);
        const layer = new PrivateLayer(
            this.getSubLayerProps({
                mesh: this.state["mesh"],
                meshLines: this.state["mesh_lines"],
                pickable: this.props.pickable,
                colormapName: this.props.colorMapName,
                colormapRange: this.props.colorMapRange,
                colormapClampColor: this.props.colorMapClampColor,
                undefinedPropertyValue: undefinedValue,
                undefinedPropertyColor: undefinedColor,
                colormapFunction: this.props.colorMapFunction,
                coloringMode: this.props.coloringMode,
                gridLines: this.props.gridLines,
                propertyValueRange: this.getPropertyValueRange(),
                discretePropertyValueNames:
                    this.props.discretePropertyValueNames,
                material: this.props.material,
                depthTest: this.props.depthTest,
                ZIncreasingDownwards: this.props.ZIncreasingDownwards,
                enableLighting,
            })
        );
        return [layer];
    }

    private getPropertyValueRange(): [number, number] {
        const bbox = this.state["bbox"] as BoundingBox3D;
        switch (this.props.coloringMode) {
            case TGrid3DColoringMode.X:
                return [bbox[0], bbox[3]];
            case TGrid3DColoringMode.Y:
                return [bbox[1], bbox[4]];
            case TGrid3DColoringMode.Z:
                return this.props.ZIncreasingDownwards
                    ? [-bbox[5], -bbox[2]]
                    : [bbox[2], bbox[5]];
            default:
                return this.state["propertyValueRange"] as [number, number];
        }
    }

    private getUndefinedPropertyValue(): number {
        if (typeof this.props.undefinedPropertyValue === "number") {
            //Precision should be reduced to single for correct comparing property values
            // with undefined property value in the webworker.
            return new Float32Array([this.props.undefinedPropertyValue])[0];
        }
        if (this.props.propertiesData instanceof Uint16Array) {
            return 0xffff;
        }
        return Number.NaN;
    }

    private getUndefinedPropertyColor(): RGBColor {
        const colorFunc = this.props.colorMapFunction;
        if (
            this.props.propertiesData?.length === 0 &&
            this.isColormapFunctionConstantColor(colorFunc)
        ) {
            return [colorFunc[0], colorFunc[1], colorFunc[2]];
        }
        return this.props.undefinedPropertyColor ?? [204, 204, 204];
    }

    private isColormapFunctionConstantColor(
        colorFunc: Uint8Array | ColormapFunctionType | undefined
    ): colorFunc is Uint8Array {
        return (
            (Array.isArray(colorFunc) || colorFunc instanceof Uint8Array) &&
            colorFunc.length >= 3
        );
    }
}

Grid3DLayer.layerName = "Grid3DLayer";
Grid3DLayer.defaultProps = defaultProps as unknown as Grid3DLayerProps;
