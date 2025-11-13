export default `\
#version 300 es
#define SHADER_NAME graph-layer-fragment-shader

precision highp float;

out vec4 fragColor;

in vec3 vColor;
in vec3 position_commonspace;
in vec3 cameraPosition;
in float myMds_;

uniform vec3 myColors[256];

//uniform vec2 u_resolution;
// uniform vec2 u_mouse;
// uniform float u_time;

// uniform float width;
// uniform float height;
// uniform float time;

float random (vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}

void main(void) {
  //vec2 st = gl_FragCoord.xy / vec2(100, 100); ///u_resolution.xy;
  //float rnd = random(st);

  vec3 normal = normalize(cross(dFdx(position_commonspace), dFdy(position_commonspace)));

  //vec3 color = vec3(myMds_, myMds_, myMds_);
  //int index = int(myMds_ * 255.0);
  //int index = int(rnd * 255.0);
  //vec3 color = myColors[index];
  vec3 color = vColor;
    

  vec3 lightColor = lighting_getLightColor(color, cameraPosition, position_commonspace, normal);
  fragColor = vec4(lightColor, 1.0);

  //fragColor = vec4(vColor, 1.0);
  //fragColor = vec4(color, 1.0);
}
`;
