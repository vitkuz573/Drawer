using Drawer.Models;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace Drawer.Components.Pages;

public partial class Home
{
    private string SelectedTool { get; set; } = "rect";

    private string SelectedColor { get; set; } = "#0000ff";

    private bool IsLocked { get; set; }

    private string JsonInput { get; set; } = "[]";

    private ElementReference _svgElement;
    private Shape? _selectedShape;

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            await JsRuntime.InvokeVoidAsync("initialize", _svgElement, DotNetObjectReference.Create(this));
            await UpdateJson();
        }
    }

    private async Task OnToolChanged(ChangeEventArgs e)
    {
        SelectedTool = e.Value.ToString();

        if (SelectedTool != null)
        {
            await JsRuntime.InvokeVoidAsync("setTool", SelectedTool);
        }
    }

    private async Task OnLockChanged(ChangeEventArgs e)
    {
        IsLocked = (bool)e.Value;

        await JsRuntime.InvokeVoidAsync("setLock", IsLocked);
    }

    [JSInvokable]
    public async Task OnShapeSelected(Shape shape)
    {
        _selectedShape = shape;

        await UpdateJson();

        StateHasChanged();
    }

    private async Task UpdateJson()
    {
        JsonInput = await JsRuntime.InvokeAsync<string>("getShapes");
    }

    private async Task DeleteShape()
    {
        if (_selectedShape != null)
        {
            await JsRuntime.InvokeVoidAsync("deleteShape", _selectedShape);

            _selectedShape = null;

            await UpdateJson();
        }
    }

    private async Task CustomAction()
    {
        if (_selectedShape != null)
        {
            await JsRuntime.InvokeVoidAsync("alert", $"Custom Action for {_selectedShape.Type}");
        }
    }
}
