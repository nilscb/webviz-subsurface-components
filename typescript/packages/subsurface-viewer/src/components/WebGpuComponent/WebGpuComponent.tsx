import React from "react";
import { useEffect, useRef } from "react";
import triangleVertWGSL from "./triangle.vert.wgsl?raw";  // raw.. vite fixer det uten loader da..
import redFragWGSL from "./red.frag.wgsl?raw";

export interface WebGpuComponentProps {
  // // Needed the zoom value to calculate width in units
  // zoom?: number;
  // // Scale increment value
  // incrementValue?: number | null;
}

export const WebGpuComponent: React.FC<WebGpuComponentProps> = ({
  // zoom = -3,
  // incrementValue = 100,
}: WebGpuComponentProps) => {

    const canvasRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current) {
          const f = async () => {
                const canvas = canvasRef.current;
                const context = canvas.getContext("webgpu"); // webgpu 2d

                const adapter = await navigator.gpu?.requestAdapter();
                const device = await adapter?.requestDevice();

                const devicePixelRatio = window.devicePixelRatio;

                const w = canvas.clientWidth * devicePixelRatio;
                const h = canvas.clientHeight * devicePixelRatio;
                const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

                context.configure({
                    device,
                    format: presentationFormat,
                });

                //-- pipeline
                const pipeline = device.createRenderPipeline({
                  label: "Min forste trekant.",
                    layout: "auto",
                    vertex: {
                        module: device.createShaderModule({
                            code: triangleVertWGSL,
                        }),
                    },
                    fragment: {
                        module: device.createShaderModule({
                            code: redFragWGSL,
                        }),
                        targets: [
                            {
                                format: presentationFormat,
                            },
                        ],
                    },
                    primitive: {
                        topology: "triangle-list",
                    },
                });

                function frame() {
                    const commandEncoder = device.createCommandEncoder();
                    const textureView = context.getCurrentTexture().createView();


                    const renderPassDescriptor: GPURenderPassDescriptor = {
                        colorAttachments: [
                            {
                                view: textureView,
                                clearValue: [0, 0.3, 0.3, 0], // Clear to transparent
                                loadOp: "clear",
                                storeOp: "store",
                            },
                        ],
                  };

                    const passEncoder =
                        commandEncoder.beginRenderPass(renderPassDescriptor);
                    passEncoder.setPipeline(pipeline);
                    passEncoder.draw(3);
                    passEncoder.end();

                    device.queue.submit([commandEncoder.finish()]);
                    requestAnimationFrame(frame);
                }

                requestAnimationFrame(frame);

                console.log("presentationFormat", presentationFormat, w, h);
            };
            f();
        }
    }); // end useEffect

    return (
        <canvas ref={canvasRef} width="500" height="500">
            {"An alternative text describing what your canvas displays."}
        </canvas>
    );
}


//https://nextjs.org/learn-pages-router/basics/create-nextjs-app/setup
//https://codelabs.developers.google.com/your-first-webgpu-app#0
//https://webgpu.github.io/webgpu-samples/?sample=helloTriangle
//https://stackoverflow.com/questions/71535213/a-way-to-load-wglsl-files-in-typescript-files-using-esbuild