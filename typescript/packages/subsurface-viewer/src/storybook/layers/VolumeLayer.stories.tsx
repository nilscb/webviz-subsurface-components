import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import DeckGL from "@deck.gl/react";

import type { SubsurfaceViewerProps } from "../../SubsurfaceViewer";
import SubsurfaceViewer from "../../SubsurfaceViewer";


import VolumeLayer from "../../layers/volume/volumeLayer";
import AxesLayer from "../../layers/axes/axesLayer";
import { loadDataArray } from "../../utils";
//import { default3DViews } from "../sharedSettings";

const stories: Meta = {
    component: DeckGL,
    title: "SubsurfaceViewer / VolumeLayer",
    tags: ["no-test"],
};

export default stories;

const parameters = {
    docs: {
        docs: {
            inlineStories: false,
            iframeHeight: 500,
        },
        description: {
            story: "Simgrid.",
        },
    },
};

// fetch data
const propertiesData = await loadDataArray(
    "seismic_Z0_115_103.float32",
    Float32Array
);

const volumeLayer = new VolumeLayer({
    id: "volume-layer1",
    name: "Volume Layer",
    parameters: { cull: false },  // viktig så vi ser innsiden av kuben
    propertiesData: propertiesData!,
    width: 115,
    height: 103,
    smooth: true,
});

const axesLayer = new AxesLayer({
    //"@@type": "AxesLayer",
    id: "axes-layer2",
    bounds: [0, 0, 0, 1, 1, 1],
    ZIncreasingDownwards: false,
    // parameters: {
    //     depthTest: false // Disables depth testing for this layer
    // }
});

// export const VolumeStory: StoryObj<typeof SubsurfaceViewer> = {
//     args: {
//         id: "volume-layer",
//         cameraPosition: {
//             rotationOrbit: 45,
//             rotationX: 25,
//             //zoom: [-100, -100, -10, 100, 100, 60] as BoundingBox3D,
//             zoom: 8,
//             target: [0.5, 0.5, 0.5],
//         },
//         layers: [volumeLayer, axesLayer],
//         views: {
//             layout: [1, 1] as [number, number],
//             viewports: [
//                 {
//                     id: "view_1",
//                     show3D: true,
//                 },
//             ],
//         },
//     },
//     render: (args) => <SubsurfaceViewer {...args} />,
// };

const VolumeComponent: React.FC<{
    alpha: number;
    smooth: boolean;
}> = (args) => {
    const subsurfaceViewerArgs = {
        id: "map",
        layers: [
            new VolumeLayer({
                id: "volume-layer1",
                name: "Volume Layer",
                parameters: { cull: false }, // viktig så vi ser innsiden av kuben
                propertiesData: propertiesData!,
                width: 115,
                height: 103,
                smooth: args.smooth,
                alpha: args.alpha,
            }),
            axesLayer,
        ],
        cameraPosition: {
            rotationOrbit: 45,
            rotationX: 25,
            zoom: 8.5,
            target: [0.5, 0.5, 0.5],
        },
        views: {
            layout: [1, 1] as [number, number],
            viewports: [
                {
                    id: "view_1",
                    show3D: true,
                },
            ],
        },
    };
    return <SubsurfaceViewer {...subsurfaceViewerArgs} />;
};

export const TypedArrayInput: StoryObj<typeof VolumeComponent> = {
    args: {
        alpha: 0.006,
        smooth: true,
    },
    argTypes: {
        alpha: {
            control: { type: "range", min: 0.001, max: 0.01, step: 0.001 },
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
