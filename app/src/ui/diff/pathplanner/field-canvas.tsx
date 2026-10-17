import * as React from 'react'
import {
  IPathPlannerPath,
  IPathPlannerSettings,
  INavGrid,
  IPoint2D,
} from '../../../models/pathplanner'
import {
  samplePath,
  getStateAtTime,
  ISampledPoint,
} from '../../../lib/pathplanner/bezier-math'
import { FieldYear } from './pathplanner-diff-header'

interface IFieldCanvasProps {
  readonly oldPath: IPathPlannerPath | null
  readonly newPath: IPathPlannerPath | null
  readonly settings: IPathPlannerSettings
  readonly navgrid: INavGrid
  readonly fieldYear: FieldYear
  readonly showControlHandles: boolean
  readonly showRobotFootprints: boolean
  readonly showZonesAndMarkers: boolean
  readonly showNavGrid: boolean
  readonly playbackTime: number
  readonly oldOpacity?: number
  readonly newOpacity?: number
  readonly title?: string
}

export class FieldCanvas extends React.Component<IFieldCanvasProps> {
  private canvasRef = React.createRef<HTMLCanvasElement>()
  private fieldImage: HTMLImageElement | null = null

  public componentDidMount() {
    this.loadFieldImage()
    this.renderCanvas()
  }

  public componentDidUpdate(prevProps: IFieldCanvasProps) {
    if (prevProps.fieldYear !== this.props.fieldYear) {
      this.loadFieldImage()
    } else {
      this.renderCanvas()
    }
  }

  private loadFieldImage() {
    if (this.props.fieldYear === 'grid-only') {
      this.fieldImage = null
      this.renderCanvas()
      return
    }

    const img = new Image()
    let imageName = 'field25.png'
    if (this.props.fieldYear === 'field26') {
      imageName = 'field26.png'
    } else if (this.props.fieldYear === 'field24') {
      imageName = 'field24.png'
    }

    // Try loading bundled static asset or fallback
    img.src = `static/pathplanner/${imageName}`
    img.onload = () => {
      this.fieldImage = img
      this.renderCanvas()
    }
    img.onerror = () => {
      // Fallback to field25.png
      if (imageName !== 'field25.png') {
        const fallback = new Image()
        fallback.src = 'static/pathplanner/field25.png'
        fallback.onload = () => {
          this.fieldImage = fallback
          this.renderCanvas()
        }
        fallback.onerror = () => {
          this.fieldImage = null
          this.renderCanvas()
        }
      } else {
        this.fieldImage = null
        this.renderCanvas()
      }
    }
  }

  private toCanvas(
    pt: IPoint2D,
    width: number,
    height: number,
    fieldSize: IPoint2D
  ): { x: number; y: number } {
    const x = (pt.x / fieldSize.x) * width
    const y = (1.0 - pt.y / fieldSize.y) * height
    return { x, y }
  }

  private renderCanvas() {
    const canvas = this.canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const width = canvas.width
    const height = canvas.height
    const fieldSize = this.props.navgrid.field_size || { x: 16.54, y: 8.07 }

    ctx.clearRect(0, 0, width, height)

    // 1. Draw Field Background
    if (this.fieldImage && this.props.fieldYear !== 'grid-only') {
      ctx.drawImage(this.fieldImage, 0, 0, width, height)
    } else {
      ctx.fillStyle = '#1e1e24'
      ctx.fillRect(0, 0, width, height)

      // Meter Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 1
      for (let x = 0; x <= fieldSize.x; x += 1.0) {
        const c = this.toCanvas({ x, y: 0 }, width, height, fieldSize)
        ctx.beginPath()
        ctx.moveTo(c.x, 0)
        ctx.lineTo(c.x, height)
        ctx.stroke()
      }
      for (let y = 0; y <= fieldSize.y; y += 1.0) {
        const c = this.toCanvas({ x: 0, y }, width, height, fieldSize)
        ctx.beginPath()
        ctx.moveTo(0, c.y)
        ctx.lineTo(width, c.y)
        ctx.stroke()
      }
    }

    // 2. Draw NavGrid Obstacles
    if (this.props.showNavGrid && this.props.navgrid.grid.length > 0) {
      const { grid, nodeSizeMeters } = this.props.navgrid
      ctx.fillStyle = 'rgba(248, 81, 73, 0.22)'
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c]) {
            const xMeters = c * nodeSizeMeters
            const yMeters = r * nodeSizeMeters
            const pt = this.toCanvas(
              { x: xMeters, y: yMeters + nodeSizeMeters },
              width,
              height,
              fieldSize
            )
            const w = (nodeSizeMeters / fieldSize.x) * width
            const h = (nodeSizeMeters / fieldSize.y) * height
            ctx.fillRect(pt.x, pt.y, w, h)
          }
        }
      }
    }

    // 3. Render Old Path (Red / Dashed)
    if (this.props.oldPath) {
      ctx.save()
      ctx.globalAlpha = this.props.oldOpacity ?? 0.85
      this.drawTrajectory(
        ctx,
        this.props.oldPath,
        '#f85149',
        true,
        width,
        height,
        fieldSize
      )
      ctx.restore()
    }

    // 4. Render New Path (Green / Solid)
    if (this.props.newPath) {
      ctx.save()
      ctx.globalAlpha = this.props.newOpacity ?? 1.0
      this.drawTrajectory(
        ctx,
        this.props.newPath,
        '#2ea043',
        false,
        width,
        height,
        fieldSize
      )
      ctx.restore()
    }

    // 5. Waypoint Displacement Links (Moved Anchors)
    if (
      this.props.oldPath &&
      this.props.newPath &&
      this.props.showControlHandles
    ) {
      this.drawDisplacementLinks(ctx, width, height, fieldSize)
    }

    // 6. Animated Robot Ghosts
    if (this.props.playbackTime > 0) {
      if (this.props.oldPath) {
        const oldSampled = samplePath(this.props.oldPath)
        const oldState = getStateAtTime(oldSampled, this.props.playbackTime)
        if (oldState) {
          this.drawRobotChassis(
            ctx,
            oldState.pos,
            oldState.rotationDegrees,
            'rgba(248, 81, 73, 0.4)',
            '#f85149',
            width,
            height,
            fieldSize
          )
        }
      }
      if (this.props.newPath) {
        const newSampled = samplePath(this.props.newPath)
        const newState = getStateAtTime(newSampled, this.props.playbackTime)
        if (newState) {
          this.drawRobotChassis(
            ctx,
            newState.pos,
            newState.rotationDegrees,
            'rgba(46, 160, 67, 0.5)',
            '#2ea043',
            width,
            height,
            fieldSize
          )
        }
      }
    }
  }

  private drawTrajectory(
    ctx: CanvasRenderingContext2D,
    path: IPathPlannerPath,
    color: string,
    isDashed: boolean,
    width: number,
    height: number,
    fieldSize: IPoint2D
  ) {
    const sampled = samplePath(path, 30)
    if (sampled.length < 2) {
      return
    }

    // A. Draw Curve
    ctx.beginPath()
    const first = this.toCanvas(sampled[0].pos, width, height, fieldSize)
    ctx.moveTo(first.x, first.y)

    for (let i = 1; i < sampled.length; i++) {
      const pt = this.toCanvas(sampled[i].pos, width, height, fieldSize)
      ctx.lineTo(pt.x, pt.y)
    }

    ctx.strokeStyle = color
    ctx.lineWidth = 3
    if (isDashed) {
      ctx.setLineDash([7, 5])
    } else {
      ctx.setLineDash([])
    }
    ctx.stroke()
    ctx.setLineDash([])

    // B. Draw Constraint Zones / Point-Towards Zones
    if (this.props.showZonesAndMarkers && path.constraintZones) {
      for (const zone of path.constraintZones) {
        ctx.beginPath()
        let inZone = false
        for (const pt of sampled) {
          if (
            pt.waypointRelativePos >= zone.minWaypointRelativePos &&
            pt.waypointRelativePos <= zone.maxWaypointRelativePos
          ) {
            const c = this.toCanvas(pt.pos, width, height, fieldSize)
            if (!inZone) {
              ctx.moveTo(c.x, c.y)
              inZone = true
            } else {
              ctx.lineTo(c.x, c.y)
            }
          }
        }
        ctx.strokeStyle = '#d29922'
        ctx.lineWidth = 6
        ctx.stroke()
      }
    }

    // C. Draw Waypoints & Handles
    for (let i = 0; i < path.waypoints.length; i++) {
      const wp = path.waypoints[i]
      const anchor = this.toCanvas(wp.anchor, width, height, fieldSize)

      // Tangent handles
      if (this.props.showControlHandles) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
        ctx.lineWidth = 1.5

        if (wp.prevControl) {
          const prev = this.toCanvas(wp.prevControl, width, height, fieldSize)
          ctx.beginPath()
          ctx.moveTo(anchor.x, anchor.y)
          ctx.lineTo(prev.x, prev.y)
          ctx.stroke()

          ctx.fillStyle = '#58a6ff'
          ctx.fillRect(prev.x - 3, prev.y - 3, 6, 6)
        }

        if (wp.nextControl) {
          const next = this.toCanvas(wp.nextControl, width, height, fieldSize)
          ctx.beginPath()
          ctx.moveTo(anchor.x, anchor.y)
          ctx.lineTo(next.x, next.y)
          ctx.stroke()

          ctx.fillStyle = '#58a6ff'
          ctx.fillRect(next.x - 3, next.y - 3, 6, 6)
        }
      }

      // Anchor circle
      ctx.beginPath()
      ctx.arc(anchor.x, anchor.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Linked Name / Index badge
      ctx.fillStyle = '#ffffff'
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      const label = wp.linkedName || `#${i}`
      ctx.fillText(label, anchor.x + 8, anchor.y - 6)
    }

    // D. Robot Footprints at start, targets, and end
    if (this.props.showRobotFootprints) {
      if (path.idealStartingState) {
        this.drawRobotChassis(
          ctx,
          path.waypoints[0].anchor,
          path.idealStartingState.rotation,
          'rgba(255, 255, 255, 0.1)',
          color,
          width,
          height,
          fieldSize
        )
      }

      if (path.rotationTargets) {
        for (const target of path.rotationTargets) {
          const u = target.waypointRelativePos
          const idx = Math.floor(u)
          if (idx < path.waypoints.length) {
            const anchor = path.waypoints[idx].anchor
            this.drawRobotChassis(
              ctx,
              anchor,
              target.rotationDegrees,
              'rgba(255, 255, 255, 0.08)',
              color,
              width,
              height,
              fieldSize
            )
          }
        }
      }

      if (path.goalEndState && path.waypoints.length > 0) {
        this.drawRobotChassis(
          ctx,
          path.waypoints[path.waypoints.length - 1].anchor,
          path.goalEndState.rotation,
          'rgba(255, 255, 255, 0.1)',
          color,
          width,
          height,
          fieldSize
        )
      }
    }

    // E. Event Markers
    if (this.props.showZonesAndMarkers && path.eventMarkers) {
      for (const marker of path.eventMarkers) {
        const u = marker.waypointRelativePos
        const idx = Math.floor(u)
        if (idx < path.waypoints.length) {
          const pt = path.waypoints[idx].anchor
          const c = this.toCanvas(pt, width, height, fieldSize)
          ctx.fillStyle = '#f0883e'
          ctx.beginPath()
          ctx.arc(c.x, c.y, 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#f0883e'
          ctx.font = '9px monospace'
          ctx.fillText(`⚡ ${marker.name}`, c.x + 6, c.y + 12)
        }
      }
    }
  }

  private drawDisplacementLinks(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    fieldSize: IPoint2D
  ) {
    if (!this.props.oldPath || !this.props.newPath) {
      return
    }

    const minLen = Math.min(
      this.props.oldPath.waypoints.length,
      this.props.newPath.waypoints.length
    )

    for (let i = 0; i < minLen; i++) {
      const oldWp = this.props.oldPath.waypoints[i]
      const newWp = this.props.newPath.waypoints[i]

      const dx = newWp.anchor.x - oldWp.anchor.x
      const dy = newWp.anchor.y - oldWp.anchor.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 0.02) {
        const cOld = this.toCanvas(oldWp.anchor, width, height, fieldSize)
        const cNew = this.toCanvas(newWp.anchor, width, height, fieldSize)

        ctx.beginPath()
        ctx.moveTo(cOld.x, cOld.y)
        ctx.lineTo(cNew.x, cNew.y)
        ctx.strokeStyle = '#e3b341'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 3])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }

  private drawRobotChassis(
    ctx: CanvasRenderingContext2D,
    pos: IPoint2D,
    rotationDegrees: number,
    fillColor: string,
    strokeColor: string,
    width: number,
    height: number,
    fieldSize: IPoint2D
  ) {
    const center = this.toCanvas(pos, width, height, fieldSize)
    const robotWidthPx = (this.props.settings.robotWidth / fieldSize.x) * width
    const robotLengthPx =
      (this.props.settings.robotLength / fieldSize.y) * height

    ctx.save()
    ctx.translate(center.x, center.y)
    // Invert rotation because y axis in canvas is inverted
    ctx.rotate((-rotationDegrees * Math.PI) / 180.0)

    // Bumper Rectangle
    ctx.fillStyle = fillColor
    ctx.fillRect(
      -robotLengthPx / 2,
      -robotWidthPx / 2,
      robotLengthPx,
      robotWidthPx
    )

    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 2
    ctx.strokeRect(
      -robotLengthPx / 2,
      -robotWidthPx / 2,
      robotLengthPx,
      robotWidthPx
    )

    // Front indicator arrow (+X robot relative)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(robotLengthPx / 2 - 2, 0)
    ctx.lineTo(robotLengthPx / 2 - 6, -4)
    ctx.moveTo(robotLengthPx / 2 - 2, 0)
    ctx.lineTo(robotLengthPx / 2 - 6, 4)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.restore()
  }

  public render() {
    return (
      <div className="field-canvas-container">
        {this.props.title && (
          <div className="canvas-title">{this.props.title}</div>
        )}
        <canvas
          ref={this.canvasRef}
          width={900}
          height={440}
          className="field-canvas"
        />
      </div>
    )
  }
}
