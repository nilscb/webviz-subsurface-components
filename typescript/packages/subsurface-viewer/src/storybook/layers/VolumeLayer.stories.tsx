import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import DeckGL from "@deck.gl/react/typed";
import SubsurfaceViewer from "../../SubsurfaceViewer";
import VolumeLayer from "../../layers/volume/volumeLayer";
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

const volumeLayer = {
    "@@type": "VolumeLayer",
    ...layerProps,
};

const axesLayer = {
    "@@type": "AxesLayer",
    id: "axes-layer2",
    bounds: [0, 0, 0, 1, 1, 1],
    ZIncreasingDownwards: false,
};

export const VolumeStory: StoryObj<typeof SubsurfaceViewer> = {
    args: {
        id: "volume-layer",
       // bounds: [-1.5, -1.5, 1.5, 1.5],
        cameraPosition: {
            rotationOrbit: 45,
            rotationX: 45,
            //zoom: [-100, -100, -10, 100, 100, 60] as BoundingBox3D,
            zoom: 8,
            target: [0, 0, 0],
        },
        //layers: [new VolumeLayer({ ...layerProps }),],
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
