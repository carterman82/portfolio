using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class Drifting : MonoBehaviour
{
    [SerializeField] float driftForce = 0.01f;
    [SerializeField] float spinTorque = 0.0001f;
    [SerializeField] float noiseSpeed = 0.25f;

    Rigidbody rb;
    float seed;

    void Awake()
    {
        rb = GetComponent<Rigidbody>();
        rb.useGravity = false;
        rb.linearDamping = 1.5f;   // "drag" in Unity 5 and earlier
        rb.angularDamping = 1.0f;  // "angularDrag" in Unity 5 and earlier
        seed = Random.value * 100f; // so every object drifts differently
    }

    void FixedUpdate()
    {
        float t = Time.time * noiseSpeed + seed;

        Vector3 drift = new Vector3(
            Mathf.PerlinNoise(t, 0f),
            Mathf.PerlinNoise(0f, t),
            Mathf.PerlinNoise(t, t + 50f)
        ) - Vector3.one * 0.5f;

        Vector3 spin = new Vector3(
            Mathf.PerlinNoise(t + 10f, 0f),
            Mathf.PerlinNoise(0f, t + 20f),
            Mathf.PerlinNoise(t + 30f, t)
        ) - Vector3.one * 0.5f;

        rb.AddForce(drift * driftForce);
        rb.AddTorque(spin * spinTorque);
    }
}