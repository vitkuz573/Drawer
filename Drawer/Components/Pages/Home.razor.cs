using Drawer.Models;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using System.Text.Json;

namespace Drawer.Components.Pages;

public partial class Home : ComponentBase, IDisposable
{
    private string SelectedTool { get; set; } = "rect";

    private string SelectedColor { get; set; } = "#8b00ff";

    private bool IsLocked { get; set; }

    private string JsonInput { get; set; } = string.Empty;

    private ElementReference _svgElement;
    private readonly List<Shape> _selectedShapes = [];
    private DotNetObjectReference<Home>? _dotNetRef;

    private double _contextMenuXpx;
    private double _contextMenuYpx;
    private bool _isContextMenuVisible;

    private List<Shape> Shapes { get; set; } = [];

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            _dotNetRef = DotNetObjectReference.Create(this);

            await JsRuntime.InvokeVoidAsync("initialize", _svgElement, _dotNetRef);

            await JsRuntime.InvokeVoidAsync("setLock", IsLocked);
            await JsRuntime.InvokeVoidAsync("setColor", SelectedColor);
            await JsRuntime.InvokeVoidAsync("setTool", SelectedTool);

            await JsRuntime.InvokeVoidAsync("updateJson");
        }
    }

    private async Task OnToolChanged(ChangeEventArgs e)
    {
        SelectedTool = e.Value?.ToString() ?? "rect";

        if (!string.IsNullOrEmpty(SelectedTool))
        {
            await JsRuntime.InvokeVoidAsync("setTool", SelectedTool);
        }
    }

    private async Task OnColorChanged(ChangeEventArgs e)
    {
        SelectedColor = e.Value?.ToString() ?? "#8b00ff";

        if (!string.IsNullOrEmpty(SelectedColor))
        {
            await JsRuntime.InvokeVoidAsync("setColor", SelectedColor);
        }
    }

    private async Task OnLockChanged(ChangeEventArgs e)
    {
        IsLocked = e.Value switch
        {
            bool boolValue => boolValue,
            string stringValue when bool.TryParse(stringValue, out var parsed) => parsed,
            _ => false
        };

        await JsRuntime.InvokeVoidAsync("setLock", IsLocked);
    }

    private async Task OnJsonInputChanged(ChangeEventArgs e)
    {
        JsonInput = e.Value?.ToString() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(JsonInput))
        {
            Shapes = [];
            
            await JsRuntime.InvokeVoidAsync("updateShapesFromJson", "[]");
            
            return;
        }

        try
        {
            Shapes = JsonSerializer.Deserialize<List<Shape>>(JsonInput) ?? [];
            
            await JsRuntime.InvokeVoidAsync("updateShapesFromJson", JsonInput);
        }
        catch (JsonException ex)
        {
            await Console.Error.WriteLineAsync($"Invalid JSON: {ex.Message}");
        }
    }

    [JSInvokable]
    public async Task UpdateJson(string json)
    {
        JsonInput = json;

        Shapes = JsonSerializer.Deserialize<List<Shape>>(json) ?? [];

        await InvokeAsync(StateHasChanged);
    }

    [JSInvokable]
    public void OnShapeRightClicked(double svgX, double svgY, string shapeId)
    {
        var shape = Shapes.Find(s => s.Id == shapeId);

        if (shape == null)
        {
            return;
        }

        if (!_selectedShapes.Contains(shape))
        {
            _selectedShapes.Add(shape);
        }

        ShowContextMenu(svgX, svgY);
    }

    private async Task DeleteShape()
    {
        if (_selectedShapes.Count == 1)
        {
            var shape = _selectedShapes[0];
            await JsRuntime.InvokeVoidAsync("deleteShape", shape.Id);
            _selectedShapes.Clear();
            HideContextMenu();
            await JsRuntime.InvokeVoidAsync("updateJson");
        }
    }

    private async Task DeleteSelectedShapes()
    {
        if (_selectedShapes.Count > 1)
        {
            var shapeIds = _selectedShapes.Select(s => s.Id).ToArray();
            await JsRuntime.InvokeVoidAsync("deleteSelectedShapes", shapeIds);
            _selectedShapes.Clear();
            HideContextMenu();
            await JsRuntime.InvokeVoidAsync("updateJson");
        }
    }

    private async Task GetShapeId()
    {
        if (_selectedShapes.Count == 1)
        {
            var shape = _selectedShapes[0];
            await JsRuntime.InvokeVoidAsync("alert", $"Shape ID: {shape.Id}");

            HideContextMenu();
        }
    }

    private void ShowContextMenu(double x, double y)
    {
        _contextMenuXpx = x;
        _contextMenuYpx = y;
        _isContextMenuVisible = true;

        InvokeAsync(StateHasChanged);
    }

    [JSInvokable]
    public void HideContextMenu()
    {
        _isContextMenuVisible = false;

        InvokeAsync(StateHasChanged);
    }

    public void Dispose()
    {
        _dotNetRef?.Dispose();
    }
}
