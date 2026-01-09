import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import DeckGL from "@deck.gl/react";
import SubsurfaceViewer from "../../SubsurfaceViewer";
import VolumeLayer from "../../layers/volume/volumeLayer";
import AxesLayer from "../../layers/axes/axesLayer";
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

const volumeLayer = new VolumeLayer({
    //cullMode: 'front',
    parameters: {cull: false}
     //"@@type": "VolumeLayer",
    //...layerProps,
});

const d = -0.0;
const axesLayer = new AxesLayer({
    //"@@type": "AxesLayer",
    id: "axes-layer2",
    bounds: [0, 0, 0, 1, 1, 1],
    //bounds: [-0.5 + d, -0.5 + d, -0.5 + d, 0.5 - d, 0.5 - d, 0.5 - d],
    ZIncreasingDownwards: false,
    parameters: {
        depthTest: false // Disables depth testing for this layer
    }
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
        layers: [volumeLayer], //, axesLayer],
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
