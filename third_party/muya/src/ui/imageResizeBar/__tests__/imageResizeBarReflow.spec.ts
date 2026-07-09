// @vitest-environment happy-dom

import type { Muya } from '../../../index';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const floatingMocks = vi.hoisted(() => {
    const state: {
        callback?: () => void;
        cleanup: ReturnType<typeof vi.fn>;
    } = {
        cleanup: vi.fn(),
    };

    return {
        state,
        autoUpdate: vi.fn((_reference: Element, _floating: Element, update: () => void) => {
            state.callback = update;
            return state.cleanup;
        }),
    };
});

vi.mock('@floating-ui/dom', () => ({
    autoUpdate: floatingMocks.autoUpdate,
}));

function createMuyaStub(): Muya {
    const domNode = document.createElement('div');
    document.body.appendChild(domNode);

    return {
        domNode,
        eventCenter: {
            on: vi.fn(),
            emit: vi.fn(),
            attachDOMEvent: vi.fn(() => 'event-id'),
            detachDOMEvent: vi.fn(),
        },
    } as unknown as Muya;
}

function mutableReference() {
    const reference = document.createElement('span');
    let rect = new DOMRect(20, 30, 100, 40);
    reference.getBoundingClientRect = () => rect;

    return {
        reference,
        moveTo(next: DOMRect) {
            rect = next;
        },
    };
}

describe('ImageResizeBar reflow tracking (#2939)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        floatingMocks.autoUpdate.mockClear();
        floatingMocks.state.cleanup.mockClear();
        floatingMocks.state.callback = undefined;
    });

    it('repositions handles through autoUpdate and cleans the observer on hide', async () => {
        const { ImageResizeBar } = await import('../index');
        const resizeBar = new ImageResizeBar(createMuyaStub());
        const moving = mutableReference();
        const internals = resizeBar as unknown as {
            _container: HTMLDivElement;
            _reference: HTMLElement;
            _render: () => void;
        };

        internals._reference = moving.reference;
        internals._render();

        expect(floatingMocks.autoUpdate).toHaveBeenCalledWith(
            moving.reference,
            internals._container,
            expect.any(Function),
        );

        moving.moveTo(new DOMRect(40, 60, 80, 30));
        floatingMocks.state.callback?.();

        expect(internals._container.querySelector<HTMLElement>('.left')?.style.left).toBe('35px');
        expect(internals._container.querySelector<HTMLElement>('.right')?.style.left).toBe('115px');

        resizeBar.hide();
        expect(floatingMocks.state.cleanup).toHaveBeenCalledTimes(1);
    });
});
