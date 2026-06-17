import type { Meta, StoryObj } from "@storybook/react";
import React, { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";

import type { SubsurfaceViewerProps, ViewStateType } from "../../SubsurfaceViewer";
import SubsurfaceViewer from "../../SubsurfaceViewer";


import VolumeLayer from "../../layers/volume/volumeLayer";
import AxesLayer from "../../layers/axes/axesLayer";
import { loadDataArray } from "../../utils";
import { OrbitView } from "@deck.gl/core";
//import { default3DViews } from "../sharedSettings";

const stories: Meta = {
    component: DeckGL,
    title: "SubsurfaceViewer / VolumeLayer",
    tags: ["no-test"],
};

export default stories;

const propertiesData = await loadDataArray("seismic_volume.bin", Float32Array);
const ni = propertiesData[0];
const nj = propertiesData[1];
const nk = propertiesData[2];
//console.log("ni", ni, "nj", nj, "nk", nk);
//console.log("propertiesData", propertiesData);

const axesLayer = new AxesLayer({
    //"@@type": "AxesLayer",
    id: "axes-layer2",
    bounds: [0, 0, 0, 1, 1, 1],
    ZIncreasingDownwards: false,
    // parameters: {
    //     depthTest: false // Disables depth testing for this layer
    // }
});

//getCameraPosition
const VolumeComponent: React.FC<{
    alpha: number;
    smooth: boolean;
    planeOffset: number;
}> = (args) => {

    const xMin = 0;
    const xMax = 1;
    const yMin = 0;
    const yMax = 1;
    const zMin = 0;
    const zMax = 1;

    const [camera, setCamera] = useState<ViewStateType>({
        rotationOrbit: 45,
        rotationX: 25,
        zoom: 8.5,
        target: [(xMax - xMin) / 2, (yMax - yMin) / 2, (zMax - zMin) / 2],  //  [0.5, 0.5, 0.5],
    });

    const camPos = (input: ViewStateType) => {
        setCamera(input);
    };

    const subsurfaceViewerArgs = {
        id: "map",
        layers: [
            new VolumeLayer({
                id: "volume-layer1",
                name: "Volume Layer",
                parameters: { cull: false }, // viktig så vi ser innsiden av kuben
                propertiesData: propertiesData!.subarray(3), // skip first 3 values which are ni, nj, nk
                ni,
                nj,
                nk,

                xMin,
                xMax,
                yMin,
                yMax,
                zMin,
                zMax,

                smooth: args.smooth,
                alpha: args.alpha,
                plane_offset: args.planeOffset,
            }),
            axesLayer,
        ],
        getCameraPosition: camPos,
        cameraPosition: camera,
        views: {
            layout: [1, 1] as [number, number],
            viewports: [
                {
                    id: "view_1",
                    viewType: OrbitView,
                },
            ],
        },
    };
    return <SubsurfaceViewer {...subsurfaceViewerArgs} />;
};

export const VolumeViewer: StoryObj<typeof VolumeComponent> = {
    args: {
        alpha: 0.006,
        smooth: true,
        planeOffset: 1.732,
    },
    argTypes: {
        alpha: {
            control: { type: "range", min: 0.001, max: 0.01, step: 0.001 },
        },
        planeOffset: {
            control: { type: "range", min: 0.0, max: 1.732, step: 0.01 },
        },
        smooth: {
            control: { type: "boolean" },
        },
    },
    parameters: {
        docs: {
            //...defaultStoryParameters.docs,
            description: {
                story: "Both mesh and property data given as typed arrays arrays (as opposed to URL).",
            },
        },
    },
    render: (args) => <VolumeComponent {...args} />,
};
