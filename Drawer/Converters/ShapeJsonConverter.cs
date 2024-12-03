using Drawer.Models;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Drawer.Converters;

public class ShapeJsonConverter : JsonConverter<Shape>
{
    public override Shape Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var jsonDoc = JsonDocument.ParseValue(ref reader);
        var jsonObject = jsonDoc.RootElement;

        if (!jsonObject.TryGetProperty("Type", out var typeProperty))
        {
            throw new JsonException("Отсутствует свойство 'Type'.");
        }

        var type = typeProperty.GetString();

        return type switch
        {
            "rect" => JsonSerializer.Deserialize<Rectangle>(jsonObject.GetRawText(), options),
            _ => throw new NotSupportedException($"Тип фигуры '{type}' не поддерживается."),
        };

    }

    public override void Write(Utf8JsonWriter writer, Shape value, JsonSerializerOptions options)
    {
        switch (value)
        {
            case Rectangle rect:
                JsonSerializer.Serialize(writer, rect, options);
                break;
            default:
                throw new NotSupportedException($"Тип фигуры '{value.GetType()}' не поддерживается для сериализации.");
        }
    }
}
