using Drawer.Models;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace Drawer.Components.Pages;

public partial class Home : ComponentBase, IDisposable
{
    private string SelectedTool { get; set; } = "rect";

    private string SelectedColor { get; set; } = "#0000ff";

    private bool IsLocked { get; set; }

    private string JsonInput { get; set; } = "[]";

    private ElementReference _svgElement;
    private Shape? _selectedShape;
    private DotNetObjectReference<Home>? _dotNetRef;

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            _dotNetRef = DotNetObjectReference.Create(this);

            await JsRuntime.InvokeVoidAsync("initialize", _svgElement, _dotNetRef);
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

    private async Task OnLockChanged(ChangeEventArgs e)
    {
        IsLocked = (bool)(e.Value ?? false);
        await JsRuntime.InvokeVoidAsync("setLock", IsLocked);
    }

    public void OnShapeSelected(Shape shape)
    {
        _selectedShape = shape;

        StateHasChanged();
    }

    [JSInvokable]
    public async Task UpdateJson(string json)
    {
        JsonInput = json;

        await InvokeAsync(StateHasChanged);
    }

    private async Task DeleteShape()
    {
        if (_selectedShape != null)
        {
            await JsRuntime.InvokeVoidAsync("deleteShape", _selectedShape);
            _selectedShape = null;
            await JsRuntime.InvokeVoidAsync("updateJson");
        }
    }

    private async Task CustomAction()
    {
        if (_selectedShape != null)
        {
            await JsRuntime.InvokeVoidAsync("alert", $"Custom Action for {_selectedShape.Type}");
        }
    }

    public void Dispose()
    {
        _dotNetRef?.Dispose();
    }
}
