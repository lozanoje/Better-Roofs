/*******************************************************
 * HELPER FUNCTIONS TO PROCESS THE LOGIC OF THE MODULE *
 *******************************************************/

class betterRoofsHelpers {
  /******************************************
   * MASK THE FOG WITH THE SPRITE OF A TILE *
   ******************************************/

  showTileThroughFog(tile) {
    tile.alpha = 1;
    let oldSprite = _betterRoofs.fogRoofContainer.children.find(
      (c) => c.name == tile.id
    );
    let tileImg = tile.children[0];
    if (!tileImg || oldSprite || !tileImg.texture.baseTexture) return;
    let sprite = new PIXI.Sprite.from(tileImg.texture);
    sprite.tint = 0xffffff;
    sprite.isSprite = true;
    sprite.width = tile.data.width;
    sprite.height = tile.data.height;
    sprite.position = tile.position;
    sprite.position.x += tileImg.x;
    sprite.position.y += tileImg.y;
    sprite.anchor = tileImg.anchor;
    sprite.angle = tileImg.angle;
    sprite.alpha = game.settings.get("betterroofs", "fogVisibility");
    sprite.blendMode = 26;
    sprite.name = tile.id;
    _betterRoofs.fogRoofContainer.spriteIndex[tile.id] = sprite;
    _betterRoofs.fogRoofContainer.addChild(sprite);
  }

  /**********************************************************
   * REMOVE THE MASK SPRITE GENERATED BY SHOWTILETHROUGHFOG *
   **********************************************************/
  hideTileThroughFog(tile) {
    let sprite = _betterRoofs.fogRoofContainer.children.find(
      (c) => c.name == tile.id
    );
    if (sprite) _betterRoofs.fogRoofContainer.removeChild(sprite);
  }

  /*****************************
   * GENERATE THE MASK POLYGON *
   *****************************/

  drawSightPoli(token) {
    let sightPoli = new PIXI.Graphics();
    let polipoints = canvas.sight.sources.get(`Token.${token.id}`).los.points;
    sightPoli
      .beginFill(0xffffff)
      .drawRect(0, 0, canvas.dimensions.width, canvas.dimensions.height)
      .endFill();
    sightPoli.beginHole().drawPolygon(polipoints).endHole();
    sightPoli.isMask = true;
    return sightPoli;
  }

  /**************************************************************
   * DECIDE IF A TILE SHOULD BE SHOWN OR HIDDEN THROUGH THE FOG *
   **************************************************************/

  computeShowHideTile(tile, overrideHide, controlledToken, brMode) {
    let pointSource = canvas.scene.data.globalLight
      ? canvas.sight.sources.get(`Token.${controlledToken.id}`).los.points
      : canvas.sight.sources.get(`Token.${controlledToken.id}`).fov.points;
    if (
      !tile.occluded &&
      !overrideHide &&
      this.checkIfInPoly(pointSource, tile, controlledToken, 1)
    ) {
      this.showTileThroughFog(tile);
    } else {
      if (brMode == 2 && _betterRoofs.foregroundSightMaskContainers[tile.id]) {
        _betterRoofs.foregroundSightMaskContainers[tile.id].removeChildren();
        tile.mask = null;
      }
      this.hideTileThroughFog(tile);
    }
  }

  /**********************************************************************
   * DECIDE IF A TILE SHOULD BE HIDDEN BASED ON SIGHT INSIDE A BUILDING *
   **********************************************************************/

  computeHide(controlledToken, tile, overrideHide) {
    if (
      this.checkIfInPoly(
        canvas.sight.sources.get(`Token.${controlledToken.id}`).los.points,
        tile,
        controlledToken,
        -1
      )
    ) {
      tile.alpha = tile.data.occlusion.alpha;
      this.hideTileThroughFog(tile);
      overrideHide = true;
    } else {
      tile.alpha = 1;
    }
    return overrideHide;
  }

  /*************************************************************************************
   * CHECK IF ANY POINT IN AN ARRAY OF POINTS IS CONTAINED INSIDE THE BUILDING POLYGON *
   *************************************************************************************/

  checkIfInPoly(points, tile, token, diff) {
    for (let i = 0; i < points.length; i += 2) {
      let pt = this.bringPointCloser(
        { x: points[i], y: points[i + 1] },
        token.center,
        diff
      );
      if (tile.roomPoly.contains(pt.x, pt.y)) {
        return true;
      }
    }
    return false;
  }

  /*************************************************************
   * DECIDE IF A MASK SHOULD BE APPLIED AND CLEAR UNUSED MASKS *
   *************************************************************/

  computeMask(tile, controlledToken) {
    _betterRoofs.foregroundSightMaskContainers[tile.id].removeChildren();
    if (!tile.occluded) {
      if (!tile.mask)
        tile.mask = _betterRoofs.foregroundSightMaskContainers[tile.id];
      _betterRoofs.foregroundSightMaskContainers[tile.id].addChild(
        this.drawSightPoli(controlledToken)
      );
    } else {
      tile.mask = null;
    }
  }

  /**********************************
   * GET NECESSARY DATA FROM A TILE *
   **********************************/

  getTileFlags(tile) {
    let overrideHide = false;
    let brMode = tile.document.getFlag("betterroofs", "brMode");
    return { brMode, overrideHide };
  }

  /************************************************************************************
   * GENERATE A POLYGON WICH REPRESENTS THE BUILDING PERIMETER UNDER AN OVERHEAD TILE *
   ************************************************************************************/

  roomDetection(tile) {
    let buildingWalls = [];
    let tileRange = tile.document.getFlag("levels", "heightRange")?.split(",");
    let tileCorners = [
      { x: tile.x, y: tile.y }, //tl
      { x: tile.x + tile.width, y: tile.y }, //tr
      { x: tile.x, y: tile.y + tile.height }, //bl
      { x: tile.x + tile.width, y: tile.y + tile.height }, //br
    ];
    canvas.walls.placeables.forEach((wall) => {
      let wallRange = [
        wall.data.wallHeight?.wallHeightBottom,
        wall.data.wallHeight?.wallHeightTop,
      ];
      if (
        (!wallRange[0] && !wallRange[1]) ||
        tileRange.length != 2 ||
        ((wallRange[1] <= tileRange[1] && wallRange[1] >= tileRange[0]) ||
          (wallRange[0] <= tileRange[1] && wallRange[0] >= tileRange[0]))
      ) {
        let wallPoints = [
          { x: wall.coords[0], y: wall.coords[1], collides: true },
          { x: wall.coords[2], y: wall.coords[3], collides: true },
        ];
        wallPoints.forEach((point) => {
          tileCorners.forEach((c) => {
            if (
              this.checkPointInsideTile(point, tile) &&
              !canvas.walls.checkCollision(new Ray(point, c))
            ) {
              point.collides = false;
            }
          });
        });
        if (!wallPoints[0].collides && !wallPoints[1].collides)
          buildingWalls.push(wallPoints);
      }
    });
    let orderedPoints = [];
    if (buildingWalls.length < 2 || !buildingWalls) {
      return [
        { x: tile.x, y: tile.y },
        { x: tile.x + tile.width, y: tile.y },
        { x: tile.x + tile.width, y: tile.y + tile.height },
        { x: tile.x, y: tile.y + tile.height },
      ];
    }
    orderedPoints.push(buildingWalls[0][0]);
    orderedPoints.push(buildingWalls[0][1]);
    let currentCoord = buildingWalls[0][1];
    buildingWalls.splice(0, 1);

    while (buildingWalls.length != 0) {
      let nextWhile = false;
      for (let wallpoints of buildingWalls) {
        if (
          wallpoints[0].x == currentCoord.x &&
          wallpoints[0].y == currentCoord.y
        ) {
          currentCoord = wallpoints[1];
          orderedPoints.push(wallpoints[1]);
          buildingWalls.splice(buildingWalls.indexOf(wallpoints), 1);
          nextWhile = true;
          break;
        }
        if (
          wallpoints[1].x == currentCoord.x &&
          wallpoints[1].y == currentCoord.y
        ) {
          currentCoord = wallpoints[0];
          orderedPoints.push(wallpoints[0]);
          buildingWalls.splice(buildingWalls.indexOf(wallpoints), 1);
          nextWhile = true;
          break;
        }
      }
      if (nextWhile) continue;
      let simplifiedArray = [];
      for (let wallpoints of buildingWalls) {
        simplifiedArray.push({
          x: wallpoints[0].x,
          y: wallpoints[0].y,
          i: buildingWalls.indexOf(wallpoints),
          ii: 0,
        });
        simplifiedArray.push({
          x: wallpoints[1].x,
          y: wallpoints[1].y,
          i: buildingWalls.indexOf(wallpoints),
          ii: 1,
        });
      }
      const reducer = (previousC, currentC) => {
        return this.getDist(currentC, currentCoord) <
          this.getDist(previousC, currentCoord)
          ? currentC
          : previousC;
      };
      let closestWall = simplifiedArray.reduce(reducer);
      if (closestWall.ii == 0) {
        orderedPoints.push(
          buildingWalls[closestWall.i][0],
          buildingWalls[closestWall.i][1]
        );
        currentCoord = buildingWalls[closestWall.i][1];
      }
      if (closestWall.ii == 1) {
        orderedPoints.push(
          buildingWalls[closestWall.i][1],
          buildingWalls[closestWall.i][0]
        );
        currentCoord = buildingWalls[closestWall.i][0];
      }
      buildingWalls.splice(closestWall.i, 1);
    }
    return orderedPoints;
  }

  /*********************************************************
   * CHECK IF A POINT IS WITHIN THE BOUNDING BOX OF A TILE *
   *********************************************************/

  checkPointInsideTile(pt, tile, tol = 0) {
    if (
      pt.x > tile.x + tol &&
      pt.x < tile.x + tile.width - tol &&
      pt.y > tile.y + tol &&
      pt.y < tile.y + tile.height - tol
    ) {
      return true;
    } else {
      return false;
    }
  }

  /***********************************************
   * GET THE SLOPE IN RADIANS BETWEEN TWO POINTS *
   ***********************************************/

  getSlope(pt1, pt2) {
    return Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x);
  }

  /*************************************************
   * GET THE DISTANCE IN PIXELS BETWEEN TWO POINTS *
   *************************************************/

  getDist(pt1, pt2) {
    return Math.sqrt(Math.pow(pt1.x - pt2.x, 2) + Math.pow(pt1.y - pt2.y, 2));
  }

  /***************************************************
   * GET THE ROOM POLYGON AND DRAW IT IF DEBUG==TRUE *
   ***************************************************/

  getRoomPoly(tile, debug = false) {
    let pts = this.roomDetection(tile);
    if (debug) {
      let s = new PIXI.Graphics();
      let poly = new PIXI.Polygon(pts);
      s.lineStyle(4, 0x00ff00).beginFill(0xffffff, 0.7).drawPolygon(poly);
      s.tileId = tile.id;
      canvas.foreground.addChild(s);
    }
    return new PIXI.Polygon(pts);
  }

  /***************************************************************************************
   * GIVEN A POINT AND A CENTER GET THE POINT CLOSER TO THE CENTER BY THE SPECIFIED DIFF *
   ***************************************************************************************/

  bringPointCloser(point, center, diff) {
    let slope = this.getSlope(point, center);
    let newL = this.getDist(point, center) + diff;
    let x = -newL * Math.cos(slope) + center.x;
    let y = -newL * Math.sin(slope) + center.y;
    return { x: x, y: y };
  }

  /*******************************************
   * CREATE WALLS ON THE EDGES OF THE CANVAS *
   *******************************************/

  async buildEdgeWalls() {
    let padX = canvas.scene.dimensions.paddingX;
    let padY = canvas.scene.dimensions.paddingY;
    let width = canvas.scene.dimensions.width - 2 * padX;
    let height = canvas.scene.dimensions.height - 2 * padY;
    let wallsCoords = [
      [padX, padY, padX + width, padY],
      [padX + width, padY, padX + width, padY + height],
      [padX + width, padY + height, padX, padY + height],
      [padX, padY + height, padX, padY],
    ];
    let wallDataArray = [];
    for (let c of wallsCoords) {
      wallDataArray.push({
        c: c,
        move: 1,
        sense: 1,
        sound: 1,
        dir: 0,
        door: 0,
        ds: 0,
      });
    }
    await canvas.scene.createEmbeddedDocuments("Wall", wallDataArray);
  }

  /************************
   * SIMPLE YES NO PROMPT *
   ************************/

  async yesNoPrompt(dTitle, dContent) {
    let dialog = new Promise((resolve, reject) => {
      new Dialog({
        title: `${dTitle}`,
        content: `<p>${dContent}</p>`,
        buttons: {
          one: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize("betterroofs.yesnodialog.yes"),
            callback: () => {
              resolve(true);
            },
          },
          two: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("betterroofs.yesnodialog.no"),
            callback: () => {
              resolve(false);
            },
          },
        },
        default: "two",
      }).render(true);
    });
    let result = await dialog;
    return result;
  }

  /*******************************
   * SAVE THE TILE CONFIGURATION *
   *******************************/

  async saveTileConfig(event) {
    let html = this.offsetParent;
    if (
      !canvas.background.get(event.data.id) &&
      !canvas.foreground.get(event.data.id)
    )
      return;
    await event.data.setFlag(
      "betterroofs",
      "brMode",
      html.querySelectorAll("select[name ='br.mode']")[0].value
    );
    _betterRoofs.initializeRoofs();
    _betterRoofs.initializePIXIcontainers();
  }

  /****************************************
   * CHANGE SETTINGS FOR ALL BETTER ROOFS *
   ****************************************/

  async bulkBUpdate(
    override = false,
    brModeOverride,
    ocModeOverride,
    ocAlphaOverride,
    allOverride = false
  ) {
    if (!game.user.isGM) return;
    let content = `
    <p class="notification error">${game.i18n.localize(
      "betterroofs.bulk.notification"
    )}</p>

<div class="form-group">
          <label>${game.i18n.localize(
            "betterroofs.tileConfig.brMode.name"
          )}</label>
          <div class="form-fields">
              <select name="br.mode" data-dtype="Number">
              <option value="0">${game.i18n.localize(
                "betterroofs.tileConfig.brMode.option0"
              )}</option><option value="1">${game.i18n.localize(
      "betterroofs.tileConfig.brMode.option1"
    )}</option><option value="2">${game.i18n.localize(
      "betterroofs.tileConfig.brMode.option2"
    )}</option><option value="3">${game.i18n.localize(
      "betterroofs.tileConfig.brMode.option3"
    )}</option>
              </select>
          </div>
      </div>


      <div class="form-group">
      <label>Occlusion Mode</label>
      <div class="form-fields">
          <select name="occlusion.mode" data-dtype="Number">
              <option value="0">None (Always Visible)</option><option value="1" selected="">Fade (Entire Tile)</option><option value="2">Roof (Blocks Vision and Lighting)</option><option value="3">Radial (Surrounding Token)</option>
          </select>
      </div>
  </div>


  
      `;

    let dialog = new Dialog({
      title: game.i18n.localize("betterroofs.bulk.title"),
      content: content,
      buttons: {
        close: { label: game.i18n.localize("betterroofs.yesnodialog.no") },
        confirm: {
          label: game.i18n.localize("betterroofs.yesnodialog.yes"),
          callback: (dialog) => {
            updateTiles(dialog);
          },
        },
      },
      default: "close",
      close: () => {},
    });

    if (!override) {
      await dialog._render(true);
    } else {
      let brmode = brModeOverride;
      let ocmode = ocModeOverride;
      let relevantTiles =
        canvas.foreground.controlled.length == 0 || allOverride
          ? canvas.foreground.placeables
          : canvas.foreground.controlled;
      let updates = [];
      for (let tile of relevantTiles) {
        if (
          !tile.document.getFlag("betterroofs", "brMode") ||
          tile.document.getFlag("betterroofs", "brMode") == 0
        )
          continue;
        if (brmode != undefined)
          await tile.document.setFlag("betterroofs", "brMode", brmode);

        updates.push({
          _id: tile.id,
          "occlusion.mode":
            ocmode != undefined ? ocmode : tile.data.occlusion.mode,
          "occlusion.alpha":
            ocAlphaOverride != undefined
              ? ocAlphaOverride
              : tile.data.occlusion.alpha,
        });
      }

      canvas.scene.updateEmbeddedDocuments("Tile", updates);
    }

    async function updateTiles(dialog) {
      let brmode = parseInt(
        dialog[0].querySelectorAll('select[name="br.mode"]')[0].value
      );
      let ocmode = parseInt(
        dialog[0].querySelectorAll('select[name="occlusion.mode"]')[0].value
      );
      let relevantTiles =
        canvas.foreground.controlled.length == 0
          ? canvas.foreground.placeables
          : canvas.foreground.controlled;
      let updates = [];
      for (let tile of relevantTiles) {
        if (
          !tile.document.getFlag("betterroofs", "brMode") ||
          tile.document.getFlag("betterroofs", "brMode") == 0
        )
          continue;
        await tile.document.setFlag("betterroofs", "brMode", brmode);
        updates.push({ _id: tile.id, "occlusion.mode": ocmode });
      }

      canvas.scene.updateEmbeddedDocuments("Tile", updates);
    }
  }
}
