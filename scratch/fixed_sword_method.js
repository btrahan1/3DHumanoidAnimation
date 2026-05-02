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
            console.warn("Could not find hand bone. Available nodes:", allNodes.map(n => n.name).slice(0, 20));
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
        const blade = BABYLON.MeshBuilder.CreateCylinder("blade", { height: 1.5, diameter: 0.03 }, this.scene);
        blade.position.y = 0.8; 
        blade.parent = hilt;

        const bladeMat = new BABYLON.StandardMaterial("bladeMat", this.scene);
        bladeMat.emissiveColor = new BABYLON.Color3(0, 1, 1); 
        bladeMat.disableLighting = true;
        blade.material = bladeMat;

        // 3. Attach to Hand
        hilt.setParent(hand);
        
        // Final Polish: Scale, Position, and Rotation
        hilt.scaling = new BABYLON.Vector3(12, 12, 12); 
        hilt.position = BABYLON.Vector3.Zero();
        hilt.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);

        console.log("Laser Sword Finalized in hand:", hand.name);
        return true;
    }
