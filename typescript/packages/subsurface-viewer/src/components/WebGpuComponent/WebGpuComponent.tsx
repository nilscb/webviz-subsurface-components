import React from "react";
import { useEffect, useRef, useState } from "react";
import {vec3, mat4} from "wgpu-matrix";
import triangleVertWGSL from "./triangle.vert.wgsl";  // her brukes webpack?? raw.. vite fixer det uten loader da..
import redFragWGSL from "./red.frag.wgsl";

export interface WebGpuComponentProps {
  // Needed the zoom value to calculate width in units
  zoom?: number;
  // Scale increment value
  incrementValue?: number | null;
}

export const WebGpuComponent: React.FC<WebGpuComponentProps> = ({
  // zoom = -3,
  // incrementValue = 100,
}: WebGpuComponentProps) => {

    const canvasRef = useRef(null);

    const [mousePos, setMousePos] = useState<[number, number]>([0, 0]);  // XXX reducer i stedet??
    const [angleY, setAngleY] = useState<number>(90);
    const [angleX, setAngleX] = useState<number>(0);
    const [theDevice, setTheDevice] = useState();
    const [uniformBuffer, setUniformBuffer] = useState();


    let timeoutId = null;

    function handleMouseMove(e) {
        // XXX legge inn throtling timer på disse to??
        // https://www.dhiwise.com/post/react-mouseevent-how-to-handle-user-interactions-with-ease
        if (timeoutId === null) {
            timeoutId = setTimeout(() => {
                if (e.buttons === 1) {
                    setMousePos([e.clientX, e.clientY]);
                    setAngleX(angleX - 0.5 * (e.clientX - mousePos[0]));
                    setAngleY(angleY - 0.5 * (e.clientY - mousePos[1]));
                }
                timeoutId = null;
            }, 100);
        }
    }

    function handleMouseDown(e) {
        if (e.buttons === 1) {
            setMousePos([e.clientX, e.clientY]);
        }
    }

    useEffect(() => {
        if (canvasRef.current) {
            const f = async () => {
                //console.log("USEEFECT 1")
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

                setTheDevice(device);

                const uniformBufferSize = 16 * 4;
                const uniformBuffer = device.createBuffer({
                    label: "uniforms",
                    size: uniformBufferSize,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                });
                setUniformBuffer(uniformBuffer);
            };
            f();
        }
    }, []);


    useEffect(() => {
        //console.log("USEEFECT 2")
        if (canvasRef.current) {
            const f = async () => { // XXX denne trenges kanskje ikke mer når device er hentet i en annen effect...
                const canvas = canvasRef.current;
                const context = canvas.getContext("webgpu"); // webgpu 2d

                const devicePixelRatio = window.devicePixelRatio;

                const w = canvas.clientWidth * devicePixelRatio;
                const h = canvas.clientHeight * devicePixelRatio;
                const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

                const device = theDevice;
                if (device) {
                    const aX = angleX * (Math.PI / 180);
                    const aY = angleY * (Math.PI / 180);

                    const radius = 5;
                    const fov = 90 * (Math.PI / 180);
                    const aspect = w / h;
                    const near = 0.1;
                    const far = 100;

                    const persp = mat4.perspective(fov, aspect, near, far);

                    // compute a matrix for the camera.
                    const cameraMatrixZ = mat4.rotationZ(aX);
                    const cameraMatrixY = mat4.rotationX(aY); // XXX usk her maa det roteres rundt den NYE aksen.
                    const cameraMatrix = mat4.multiply(cameraMatrixZ, cameraMatrixY);
                    mat4.translate(cameraMatrix, [0, 0, radius], cameraMatrix);

                    // Make a view matrix from the camera matrix.
                    mat4.inverse(cameraMatrix, cameraMatrix);


                    const viewProjectionMatrix = mat4.multiply(persp, cameraMatrix);

                    //mat4.translate(viewProjectionMatrix, eye, viewProjectionMatrix);
                    //mat4.translate(viewProjectionMatrix, [x, 0, z], viewProjectionMatrix);


                    // Create unifom buffer.
                    await device.queue.writeBuffer(uniformBuffer, 0, viewProjectionMatrix );


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
                            //cullMode: "back"
                        },
                        // XXX hvorfor virker ikke dette... mulig noe layout target greier...
                        // depthStencil: {
                        //     depthWriteEnabled: true,
                        //     depthCompare: "less",
                        //     format: "depth24plus"
                        // }

                    });
                
                    const bindGroup = device.createBindGroup({
                        label: "my bind group rename please",
                        layout: pipeline.getBindGroupLayout(0),
                        entries: [
                            {
                                binding: 0,
                                resource: {
                                    buffer: uniformBuffer,
                                    offset: 0,
                                    size: 16 * 4,
                                },
                            },
                        ],
                    });

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

                    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
                    passEncoder.setPipeline(pipeline);
                    passEncoder.setBindGroup(0, bindGroup);
                    passEncoder.draw(3);
                    passEncoder.end();

                    device.queue.submit([commandEncoder.finish()]);
                }
            };
            f();
        }
    }, [angleY, theDevice]); // end useEffect

    return (
        <div onMouseMove={handleMouseMove} onMouseDown={handleMouseDown}>
        <canvas ref={canvasRef} width="500" height="500">
            {"An alternative text describing what your canvas displays."}
        </canvas>
        </div>
    );
}


//https://nextjs.org/learn-pages-router/basics/create-nextjs-app/setup
//https://codelabs.developers.google.com/your-first-webgpu-app#0
//https://webgpu.github.io/webgpu-samples/?sample=helloTriangle
//https://stackoverflow.com/questions/71535213/a-way-to-load-wglsl-files-in-typescript-files-using-esbuild