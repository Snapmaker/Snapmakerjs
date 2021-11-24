import { Color, WebGLRenderer } from 'three';

import Detector from './Detector';

/**
 * Simple wrapper of WebGLRenderer.
 *
 * Given basic renderer method mirrors and default configuration.
 */
class WebGLRendererWrapper {
    constructor(options) {
        if (Detector.isWebGLAvailable()) {
            this.renderer = new WebGLRenderer(options);
            this.renderer.setClearColor(new Color(0xF5F5F7), 1);
            this.renderer.shadowMap.enabled = true;
        } else {
            this.renderer = null;
        }
    }

    isInitialized() {
        return !!this.renderer;
    }

    get domElement() {
        return this.renderer.domElement;
    }

    setClearColor(...args) {
        this.renderer.setClearColor(args);
    }

    setSize(width, height) {
        this.renderer && this.renderer.setSize(width, height);
    }

    render(scene, camera) {
        this.renderer.render(scene, camera);
    }

    dispose() {
        if (!this.renderer) {
            return;
        }
        try {
            this.renderer.context = null;
            this.renderer.domElement = null;
            this.renderer.dispose();
            this.renderer.forceContextLoss();
            this.renderer = null;
        } catch (e) {
            console.warn(`dddddd${e}`);
        }
    }
}

export default WebGLRendererWrapper;
