import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import DeckGL from "@deck.gl/react/typed";
import SubsurfaceViewer from "../../SubsurfaceViewer";
import VolumeLayer from "../../layers/volume/volumeLayer";
import AxesLayer from "../../layers/axes/axesLayer";
import { default3DViews } from "../sharedSettings";

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

const layerProps = {
   // lines: [0, 0, 0,  1, 0, 0,  1, 0, 1],
};

const volumeLayer = new VolumeLayer({
     //"@@type": "VolumeLayer",
    ...layerProps,
});

const d = 0; //0.01;
const axesLayer = new AxesLayer({
    //"@@type": "AxesLayer",
    id: "axes-layer2",
    //bounds: [0, 0, 0, 1, 1, 1],
    bounds: [0+d, 0+d, 0+d, 1-d, 1-d, 1-d],
    ZIncreasingDownwards: false,
});

// const axesLayer2 = {
//     "@@type": "AxesLayer",
//     id: "axes-layer2",
//     bounds: [3, 3, 0, 3 + 0.5, 3 + 0.5, 0.5],
//     ZIncreasingDownwards: false,
// };

export const VolumeStory: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        id: "volume-layer",
       // bounds: [-1.5, -1.5, 1.5, 1.5],
        cameraPosition: {
            rotationOrbit: 45,
            rotationX: 25,
            //zoom: [-100, -100, -10, 100, 100, 60] as BoundingBox3D,
            zoom: 8,
            target: [0, 0, 0],
        },
        //layers: [new VolumeLayer({ ...layerProps }),],
        //layers: [volumeLayer, axesLayer, axesLayer2],
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
    parameters,
    render: (args) => <SubsurfaceViewer {...args} />,
};
