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

        var typeProperty = jsonObject.EnumerateObject()
            .FirstOrDefault(p => string.Equals(p.Name, "type", StringComparison.OrdinalIgnoreCase));

        if (typeProperty.Value.ValueKind == JsonValueKind.Undefined)
        {
            throw new JsonException("Отсутствует свойство 'type'.");
        }

        var type = typeProperty.Value.GetString();
        if (string.IsNullOrWhiteSpace(type))
        {
            throw new JsonException("Свойство 'type' не может быть пустым.");
        }

        return type switch
        {
            "rect" => JsonSerializer.Deserialize<Rectangle>(jsonObject.GetRawText(), options) ?? throw new JsonException("Не удалось десериализовать фигуру типа 'rect'."),
            "circle" => JsonSerializer.Deserialize<Circle>(jsonObject.GetRawText(), options) ?? throw new JsonException("Не удалось десериализовать фигуру типа 'circle'."),
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
            case Circle circle:
                JsonSerializer.Serialize(writer, circle, options);
                break;
            default:
                throw new NotSupportedException($"Тип фигуры '{value.GetType()}' не поддерживается для сериализации.");
        }
    }
}
