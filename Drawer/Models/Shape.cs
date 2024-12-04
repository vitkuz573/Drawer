using Drawer.Converters;
using System.Text.Json.Serialization;

namespace Drawer.Models;

[JsonConverter(typeof(ShapeJsonConverter))]
public abstract class Shape
{
    [JsonPropertyName("id")]
    public string Id { get; set; }

    [JsonPropertyName("type")]
    public string Type { get; set; }

    [JsonPropertyName("fill")]
    public string Fill { get; set; }

    [JsonPropertyName("stroke")]
    public string Stroke { get; set; }

    [JsonPropertyName("strokeWidth")]
    public double StrokeWidth { get; set; }

    [JsonPropertyName("opacity")]
    public double Opacity { get; set; }
}
