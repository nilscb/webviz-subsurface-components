import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import DeckGL from "@deck.gl/react";
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

// const layerProps = {
//     lines: [0, 0, 0, 1, 0, 0, 1, 0, 1],
// };

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

export const VolumeStory: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        id: "volume-layer",
        cameraPosition: {
            rotationOrbit: 45,
            rotationX: 25,
            //zoom: [-100, -100, -10, 100, 100, 60] as BoundingBox3D,
            zoom: 8,
            target: [0.5, 0.5, 0.5],
        },
        layers: [volumeLayer, axesLayer],
        views: {
            layout: [1, 1] as [number, number],
            viewports: [
                {
                    id: "view_1",
                    show3D: true,
                },
            ],
        },
    },
    render: (args) => <SubsurfaceViewer {...args} />,
};
