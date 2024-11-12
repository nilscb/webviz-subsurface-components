export default `\

//@group(0) @binding(0) var<uniform> ourStruct: OurStruct;
@group(0) @binding(0) var<uniform> viewProjectionMatrix : mat4x4<f32>;
//@binding(0) @group(0) var<uniform> n: f32; 

@vertex
fn main(
  @builtin(vertex_index) VertexIndex : u32
) -> @builtin(position) vec4f {

  var pos = array<vec4f, 3>(
    vec4f(-1.0, 0.0, 0.0, 1.0),
    vec4f(0.0, 3.0, 0.0, 1.0),
    vec4f(1.0, 0.0, 0.0, 1.0)
  );

  let mmm : vec4<f32> = viewProjectionMatrix * pos[VertexIndex];

  return mmm;
}
`;
