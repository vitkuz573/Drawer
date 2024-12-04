using Drawer.Converters;
using System.Text.Json.Serialization;

namespace Drawer.Models;

[JsonConverter(typeof(ShapeJsonConverter))]
public abstract class Shape
{
    public string Id { get; set; }

    public string Type { get; set; }
    
    public string Fill { get; set; }
    
    public string Stroke { get; set; }
    
    public double StrokeWidth { get; set; }
}
