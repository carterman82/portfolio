Shader "Custom/UnderwaterDistortion"
{
    Properties
    {
        _Strength  ("Strength (UV offset)", Range(0, 0.01)) = 0.003
        _Scale     ("Noise Scale", Float) = 8
        _Speed     ("Speed", Float) = 0.3
        _Intensity ("Intensity (script-driven)", Range(0, 1)) = 0
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" }
        ZWrite Off
        Cull Off
        ZTest Always

        Pass
        {
            Name "UnderwaterDistortionPass"

            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.core/Runtime/Utilities/Blit.hlsl"

            float _Strength;
            float _Scale;
            float _Speed;
            float _Intensity;

            float Hash21(float2 p)
            {
                p = frac(p * float2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return frac(p.x * p.y);
            }

            // Smooth value noise, 0..1
            float ValueNoise(float2 p)
            {
                float2 i = floor(p);
                float2 f = frac(p);
                float a = Hash21(i);
                float b = Hash21(i + float2(1, 0));
                float c = Hash21(i + float2(0, 1));
                float d = Hash21(i + float2(1, 1));
                float2 u = f * f * (3.0 - 2.0 * f);
                return lerp(lerp(a, b, u.x), lerp(c, d, u.x), u.y);
            }

            half4 Frag(Varyings input) : SV_Target
            {
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(input);

                float2 uv = input.texcoord;
                float t = _Time.y * _Speed;
                float2 p = uv * _Scale;

                // Two noise layers per axis, moving in different directions,
                // so the wobble does not look like a single sliding pattern.
                float2 offset;
                offset.x = ValueNoise(p + float2(t, t * 0.7))
                         + ValueNoise(p * 1.7 - float2(t * 0.8, t)) - 1.0;
                offset.y = ValueNoise(p + float2(31.4 - t * 0.6, 17.2 + t))
                         + ValueNoise(p * 1.9 + float2(t, -t * 0.9)) - 1.0;

                uv += offset * _Strength * _Intensity;

                return SAMPLE_TEXTURE2D_X(_BlitTexture, sampler_LinearClamp, uv);
            }
            ENDHLSL
        }
    }
}
