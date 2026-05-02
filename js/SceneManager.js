export class SceneManager {
    constructor() {
        this.canvas = document.getElementById("renderCanvas");
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = null;
        this.character = null;
        this.animationGroups = [];
        
        // Controller State
        this.inputMap = {};
        this.isMoving = false;
        this.moveSpeed = 0.1;
        this.rotationSpeed = 0.05;
        this.isArmRaised = false;
        this.headRotation = 0; 
    }

    async initScene() {
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1);

        // GLOW LAYER (Makes the laser sword actually glow)
        this.gl = new BABYLON.GlowLayer("glow", this.scene);
        this.gl.intensity = 1.5;

        // Input listeners
        this.scene.onKeyboardObservable.add((kbInfo) => {
            switch (kbInfo.type) {
                case BABYLON.KeyboardEventTypes.KEYDOWN:
                    this.inputMap[kbInfo.event.key.toLowerCase()] = true;
                    break;
                case BABYLON.KeyboardEventTypes.KEYUP:
                    this.inputMap[kbInfo.event.key.toLowerCase()] = false;
                    break;
            }
        });

        // ARM & HEAD POSE OVERRIDER (Wins against animations)
        this.scene.onAfterAnimationsObservable.add(() => {
            if (this.character) {
                // 1. ARM RAISE
                if (this.isArmRaised) {
                    const arm = this.character.getDescendants().find(n => n.name.toLowerCase().includes("rightarm")) ||
                                (this.character.skeleton ? this.character.skeleton.bones.find(b => b.name.toLowerCase().includes("rightarm")) : null);
                    if (arm) {
                        const armRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, -Math.PI / 2.2);
                        if (arm.rotationQuaternion) arm.rotationQuaternion.copyFrom(armRot);
                        else if (arm.setRotationQuaternion) arm.setRotationQuaternion(armRot, BABYLON.Space.LOCAL);
                    }
                }

                // 2. HEAD LOOK
                if (this.headRotation !== 0) {
                    const head = this.character.getDescendants().find(n => n.name.toLowerCase().includes("head")) ||
                                 (this.character.skeleton ? this.character.skeleton.bones.find(b => b.name.toLowerCase().includes("head")) : null);
                    if (head) {
                        // Rotate on the Y axis (Neck twist)
                        const headRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, this.headRotation);
                        if (head.rotationQuaternion) head.rotationQuaternion.copyFrom(headRot);
                        else if (head.setRotationQuaternion) head.setRotationQuaternion(headRot, BABYLON.Space.LOCAL);
                    }
                }
            }
        });

        // Camera - Now a Follow Camera behavior
        const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 5, new BABYLON.Vector3(0, 1, 0), this.scene);
        camera.attachControl(this.canvas, true);
        camera.lowerRadiusLimit = 2;
        camera.upperRadiusLimit = 20;

        // Lighting
        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;

        // Ground/Grid
        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 50, height: 50 }, this.scene);
        const gridMaterial = new BABYLON.GridMaterial("grid", this.scene);
        gridMaterial.mainColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        gridMaterial.lineColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        ground.material = gridMaterial;

        // Main Render Loop with Movement Logic
        this.engine.runRenderLoop(() => {
            if (this.character) {
                this.updateMovement();
            }
            this.scene.render();
        });

        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    updateMovement() {
        let moving = false;

        // Rotation (A/D)
        if (this.inputMap["a"]) {
            this.character.rotate(BABYLON.Axis.Y, -this.rotationSpeed, BABYLON.Space.LOCAL);
        }
        if (this.inputMap["d"]) {
            this.character.rotate(BABYLON.Axis.Y, this.rotationSpeed, BABYLON.Space.LOCAL);
        }

        // Forward/Backward (W/S)
        if (this.inputMap["w"]) {
            const forward = this.character.getDirection(BABYLON.Vector3.Forward());
            this.character.position.addInPlace(forward.scale(this.moveSpeed));
            moving = true;
        }
        if (this.inputMap["s"]) {
            const forward = this.character.getDirection(BABYLON.Vector3.Forward());
            this.character.position.addInPlace(forward.scale(-this.moveSpeed));
            moving = true;
        }

        // Animation State Logic
        if (moving) {
            if (!this.isMoving) {
                this.playAnimation("walk");
                this.isMoving = true;
            }
        } else {
            if (this.isMoving) {
                this.playAnimation("idle");
                this.isMoving = false;
            }
        }

        // Camera follows character
        const camera = this.scene.getCameraByName("camera");
        if (camera) {
            camera.setTarget(this.character.position.add(new BABYLON.Vector3(0, 1, 0)));
        }
    }

    async loadModel(url) {
        console.log("Loading model from:", url);
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", url, "", this.scene);
            this.character = result.meshes[0];
            this.animationGroups = result.animationGroups;

            const hierarchy = this.character.getHierarchyBoundingVectors();
            const size = hierarchy.max.subtract(hierarchy.min);
            const height = size.y;
            const scaleFactor = 2.0 / height; // Target height of 2 meters
            this.baseScale = scaleFactor;
            this.character.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor);
            this.character.position = new BABYLON.Vector3(0, 0, 0);
            
            const camera = this.scene.getCameraByName("camera");
            if (camera) {
                camera.setTarget(new BABYLON.Vector3(0, 1, 0));
                camera.radius = 5;
            }

            console.log(`Model loaded. Height: ${height.toFixed(2)}, Scale: ${scaleFactor.toFixed(4)}`);
            
            // Log available moves
            if (this.animationGroups.length > 0) {
                console.log("AVAILABLE MOVES:", this.animationGroups.map(g => g.name));
            }
            
            this.logClothing();

            return true;
        } catch (error) {
            console.error("Error loading model:", error);
            return false;
        }
    }

    async loadAnimation(url, animName) {
        console.log(`Deep Scanning ${animName} from:`, url);
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", url, "", this.scene);
            
            let finalGroup = result.animationGroups.length > 0 ? result.animationGroups[0] : new BABYLON.AnimationGroup(animName, this.scene);
            finalGroup.name = animName;

            // 1. COLLECT ALL ANIMATIONS (from groups, skeletons, or nodes)
            let allAnims = result.animations ? [...result.animations] : [];
            
            // Collect from existing groups
            result.animationGroups.forEach(g => {
                g.targetedAnimations.forEach(ta => {
                    if (!allAnims.includes(ta.animation)) allAnims.push(ta.animation);
                });
            });

            // Collect from skeletons
            if (result.skeletons) {
                result.skeletons.forEach(s => {
                    s.bones.forEach(b => {
                        if (b.animations) allAnims.push(...b.animations);
                    });
                });
            }

            console.log(`Found ${allAnims.length} potential animation tracks.`);
            
            // DIAGNOSTIC: Total Scene Dump
            console.log("--- SCENE DUMP ---");
            console.log("Nodes:", this.scene.getNodes().map(n => n.name));
            if (this.character.skeleton) {
                console.log("Skeleton Bones:", this.character.skeleton.bones.map(b => b.name));
            } else {
                console.log("No Skeleton found on character!");
            }

            // 2. RETARGET AND INJECT
            allAnims.forEach(anim => {
                let targetName = anim.targetName;
                if (!targetName && anim._runtimeAnimations && anim._runtimeAnimations[0]) {
                    targetName = anim._runtimeAnimations[0].target.name;
                }
                
                if (!targetName) return;

                const cleanName = targetName.toLowerCase().replace(/mixamorig:|base|polySurface|mesh/g, "").replace(/[^a-z0-9]/g, "");
                
                // SUPER FUZZY MATCH
                const targetNode = this.character.getDescendants(false).find(n => {
                    const nodeName = n.name.toLowerCase().replace(/mixamorig:|base|polySurface|mesh/g, "").replace(/[^a-z0-9]/g, "");
                    return nodeName.includes(cleanName) || cleanName.includes(nodeName);
                });

                if (targetNode) {
                    finalGroup.addTargetedAnimation(anim, targetNode);
                }
            });

            if (finalGroup.targetedAnimations.length > 0) {
                this.animationGroups.push(finalGroup);
                console.log(`Success! Injected ${finalGroup.targetedAnimations.length} tracks into ${animName}.`);
            } else {
                console.warn("Deep Scan failed to find valid animation targets.");
            }

            // Cleanup
            result.meshes.forEach(m => m.dispose());
            if (result.skeletons) result.skeletons.forEach(s => s.dispose());
            
            return finalGroup.targetedAnimations.length > 0;
        } catch (error) {
            console.error(`Deep Scan Error for ${animName}:`, error);
            return false;
        }
    }

    attachLaserSword() {
        if (!this.character) return;
        
        console.log("Searching for hand bone...");
        const allNodes = this.character.getDescendants(false);
        const allBones = this.character.skeleton ? this.character.skeleton.bones : [];
        
        const hand = allNodes.find(n => 
            (n.name.toLowerCase().includes("hand") || n.name.toLowerCase().includes("palm")) && 
            (n.name.toLowerCase().includes("right") || n.name.toLowerCase().includes("_r"))
        ) || allBones.find(b => 
            (b.name.toLowerCase().includes("hand") || b.name.toLowerCase().includes("palm")) && 
            (b.name.toLowerCase().includes("right") || b.name.toLowerCase().includes("_r"))
        ) || allNodes.find(n => 
            (n.name.toLowerCase().includes("hand") || n.name.toLowerCase().includes("palm")) && 
            (n.name.toLowerCase().includes("left") || n.name.toLowerCase().includes("_l"))
        ) || allBones.find(b => 
            (b.name.toLowerCase().includes("hand") || b.name.toLowerCase().includes("palm")) && 
            (b.name.toLowerCase().includes("left") || b.name.toLowerCase().includes("_l"))
        );

        if (!hand) {
            console.warn("Could not find hand bone.");
            return;
        }

        const oldSword = this.scene.getMeshByName("hilt");
        if (oldSword) oldSword.dispose();

        // 1. Create the Hilt
        const hilt = BABYLON.MeshBuilder.CreateCylinder("hilt", { height: 0.2, diameter: 0.04 }, this.scene);
        const hiltMat = new BABYLON.StandardMaterial("hiltMat", this.scene);
        hiltMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        hilt.material = hiltMat;

        // 2. Create the Blade
        const blade = BABYLON.MeshBuilder.CreateCylinder("blade", { height: 1.2, diameter: 0.02 }, this.scene);
        blade.position.y = 0.7; 
        blade.parent = hilt;

        const bladeMat = new BABYLON.StandardMaterial("bladeMat", this.scene);
        bladeMat.emissiveColor = new BABYLON.Color3(0, 1, 1); 
        bladeMat.disableLighting = true;
        blade.material = bladeMat;

        // 3. THE "INVISIBLE STRING" LOGIC
        // Instead of parenting (which inherits scaling), we follow in the render loop
        if (this.swordObserver) {
            this.scene.onBeforeRenderObservable.remove(this.swordObserver);
        }

        this.swordObserver = this.scene.onBeforeRenderObservable.add(() => {
            // 2. SWORD TRACKING
            if (!hilt) return;
            let worldPos = BABYLON.Vector3.Zero();
            let worldQuat = BABYLON.Quaternion.Identity();

            if (hand.getClassName && hand.getClassName() === "Bone") {
                worldPos = hand.getAbsolutePosition(this.character);
                worldQuat = hand.getRotationQuaternion(BABYLON.Space.WORLD, this.character);
            } else {
                worldPos = hand.absolutePosition || hand.getAbsolutePosition();
                if (hand.getAbsoluteRotationQuaternion) worldQuat = hand.getAbsoluteRotationQuaternion();
                else hand.getWorldMatrix().decompose(undefined, worldQuat, undefined);
            }

            const forward = hand.getDirection ? hand.getDirection(new BABYLON.Vector3(0, 0, 1)) : new BABYLON.Vector3(0,0,1);
            const palmOffset = forward.scale(0.15); 
            hilt.position.copyFrom(worldPos).addInPlace(palmOffset);
            
            const offset = BABYLON.Quaternion.RotationYawPitchRoll(0, -Math.PI / 2, 0);
            hilt.rotationQuaternion = worldQuat.multiply(offset);
        });

        console.log("Laser Sword 'String' attached to:", hand.name);
        return true;
    }

    setCharacterAttribute(attr, value) {
        if (!this.character || !this.baseScale) return;
        
        if (attr === "height") {
            this.character.scaling.y = this.baseScale * value;
        } else if (attr === "width") {
            this.character.scaling.x = this.baseScale * value;
            this.character.scaling.z = this.baseScale * value;
        }
    }

    applyRecipe(recipe) {
        if (!this.character) return;
        
        console.log("Applying Character Recipe:", recipe.name);

        // 1. Apply Attributes
        if (recipe.attributes) {
            if (recipe.attributes.height !== undefined) this.setCharacterAttribute("height", recipe.attributes.height);
            if (recipe.attributes.width !== undefined) this.setCharacterAttribute("width", recipe.attributes.width);
        }

        // 2. Apply Wardrobe
        if (recipe.wardrobe) {
            for (const [matName, color] of Object.entries(recipe.wardrobe)) {
                this.setMaterialColor(matName, color);
            }
        }
    }

    logClothing() {
        if (!this.character) return;
        console.log("--- WARDROBE AUDIT ---");
        this.character.getChildMeshes().forEach(m => {
            console.log(`Mesh: ${m.name} | Material: ${m.material ? m.material.name : "None"}`);
            
            // Check for Morph Targets
            if (m.morphTargetManager) {
                console.log(`  > Morph Targets found on ${m.name}:`);
                for (let i = 0; i < m.morphTargetManager.numTargets; i++) {
                    console.log(`    [${i}] ${m.morphTargetManager.getTarget(i).name}`);
                }
            }
        });
    }

    setMaterialColor(matName, hexColor) {
        if (!this.scene) return;
        const mat = this.scene.getMaterialByName(matName);
        if (mat) {
            const color = BABYLON.Color3.FromHexString(hexColor);
            // Handle both Standard and PBR materials
            if (mat.albedoColor) mat.albedoColor = color;
            else if (mat.diffuseColor) mat.diffuseColor = color;
        }
    }

    playAnimation(name) {
        const group = this.animationGroups.find(g => g.name.toLowerCase().includes(name.toLowerCase()));
        if (group) {
            this.scene.animationGroups.forEach(g => {
                if (g !== group) g.stop();
            });
            group.play(true);
            console.log(`Playing animation: ${name}`);
            return true;
        }
        console.warn(`Animation not found: ${name}`);
        return false;
    }
}

let sceneManager = null;

export function initBabylon() {
    sceneManager = new SceneManager();
    sceneManager.initScene();
}

export function loadCharacter(url) {
    return sceneManager.loadModel(url);
}

export function getAnimationNames() {
    return sceneManager.animationGroups.map(g => g.name);
}

export function addAnimation(url, name) {
    return sceneManager.loadAnimation(url, name);
}

export function equipWeapon() {
    return sceneManager.attachLaserSword();
}

export function toggleArmRaise() {
    sceneManager.isArmRaised = !sceneManager.isArmRaised;
    
    if (sceneManager.isArmRaised && sceneManager.character) {
        console.log("ARM RAISE ACTIVATED. Searching for bones...");
        const nodes = sceneManager.character.getDescendants();
        const bones = sceneManager.character.skeleton ? sceneManager.character.skeleton.bones : [];
        console.log("All Node Names:", nodes.map(n => n.name).slice(0, 50));
        console.log("All Bone Names:", bones.map(b => b.name).slice(0, 50));
    }
    
    return sceneManager.isArmRaised;
}

export function logClothing() {
    if (sceneManager) sceneManager.logClothing();
}

export function setHeadRotation(angle) {
    if (sceneManager) sceneManager.headRotation = angle;
}

export function setMaterialColor(matName, hexColor) {
    if (sceneManager) sceneManager.setMaterialColor(matName, hexColor);
}

export function setAttribute(attr, value) {
    if (sceneManager) sceneManager.setCharacterAttribute(attr, value);
}

export function applyRecipe(recipe) {
    if (sceneManager) sceneManager.applyRecipe(recipe);
}

export function playAnim(name) {
    return sceneManager.playAnimation(name);
}
