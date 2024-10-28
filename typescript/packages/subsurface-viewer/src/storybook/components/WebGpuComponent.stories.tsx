import type { Meta, StoryObj } from "@storybook/react";

import { WebGpuComponent } from "../../components/WebGpuComponent/WebGpuComponent";

const stories: Meta = {
    component: WebGpuComponent,
    title: "SubsurfaceViewer / Components / WebGpuComponent",
};
export default stories;

export const WebGpuExample: StoryObj<typeof WebGpuComponent> = {};

