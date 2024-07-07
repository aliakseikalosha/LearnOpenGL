#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D gAlbedoSpec;

struct Light {
    vec3 Position;
    vec3 Color;
    
    float Linear;
    float Quadratic;
};
const int NR_LIGHTS = 32;
uniform Light lights[NR_LIGHTS];
uniform vec3 viewPos; 
uniform float focusDepth;// 0 .. 20
uniform float focusSize;// 0.5 .. 10
uniform vec2 pixelSize;

vec4 CalculateColor(vec2 tc){

    // retrieve data from gbuffer
    vec3 FragPos = texture(gPosition, tc).rgb;
    vec3 Normal = texture(gNormal, tc).rgb;
    vec3 Diffuse = texture(gAlbedoSpec, tc).rgb;
    float Specular = texture(gAlbedoSpec, tc).a;
    
    // then calculate lighting as usual
    vec3 lighting  = Diffuse * 0.1; // hard-coded ambient component
    vec3 viewDir  = normalize(viewPos - FragPos);
    for(int i = 0; i < NR_LIGHTS; ++i)
    {
        // diffuse
        vec3 lightDir = normalize(lights[i].Position - FragPos);
        vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * lights[i].Color;
        // specular
        vec3 halfwayDir = normalize(lightDir + viewDir);  
        float spec = pow(max(dot(Normal, halfwayDir), 0.0), 16.0);
        vec3 specular = lights[i].Color * spec * Specular;
        // attenuation
        float distance = length(lights[i].Position - FragPos);
        float attenuation = 1.0 / (1.0 + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
        diffuse *= attenuation;
        specular *= attenuation;
        lighting += diffuse + specular;        
    }
    return vec4(lighting,1.0);
}

vec4 CalculateBlurred(vec4 simple, float dist)
{
    float center = 2;
    float side = 3;
    float diagonal = 1;
    vec2 ps = pixelSize * clamp(dist/focusSize, 1.0, 3.0);
    vec4 blur = simple * center
    + CalculateColor(TexCoords + vec2(0,ps.y)) * side 
    + CalculateColor(TexCoords + vec2(ps.x,0)) * side
    + CalculateColor(TexCoords + vec2(0,-ps.y)) * side
    + CalculateColor(TexCoords + vec2(-ps.x,0)) * side
    + CalculateColor(TexCoords + ps) * diagonal 
    + CalculateColor(TexCoords + -ps) * diagonal
    + CalculateColor(TexCoords + vec2(ps.x,-ps.y)) * diagonal
    + CalculateColor(TexCoords + vec2(-ps.x,ps.y)) * diagonal;
    blur /= center + 4 * side + 4 * diagonal; 

    return blur;
}

void main()
{             
    vec3 originalFragPos = texture(gPosition, TexCoords).rgb;

    float dist = abs(distance(viewPos, originalFragPos) - focusDepth);
    vec4 simple = CalculateColor(TexCoords);
    vec4 blur = CalculateBlurred(simple, dist);
    float normDist = clamp(dist/focusDepth, 0.0, 1.0);
    
    FragColor = simple * (1.0 - normDist) + blur * normDist;
}
