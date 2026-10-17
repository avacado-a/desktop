import * as React from 'react'
import {
  IPathPlannerPath,
  IPathPlannerSettings,
  INavGrid,
  PathPlannerDiffViewMode,
} from '../../../models/pathplanner'
import {
  PathPlannerDiffHeader,
  FieldYear,
} from './pathplanner-diff-header'
import { FieldCanvas } from './field-canvas'
import { samplePath } from '../../../lib/pathplanner/bezier-math'

interface IPathVisualDiffProps {
  readonly oldPath: IPathPlannerPath | null
  readonly newPath: IPathPlannerPath | null
  readonly settings: IPathPlannerSettings
  readonly navgrid: INavGrid
  readonly onRenderRawJson: () => JSX.Element
}

interface IPathVisualDiffState {
  readonly mode: PathPlannerDiffViewMode
  readonly fieldYear: FieldYear
  readonly showControlHandles: boolean
  readonly showRobotFootprints: boolean
  readonly showZonesAndMarkers: boolean
  readonly showNavGrid: boolean
  readonly onionSkinOpacity: number
  readonly isPlaying: boolean
  readonly playbackTime: number
  readonly playbackSpeed: number
}

export class PathVisualDiff extends React.Component<
  IPathVisualDiffProps,
  IPathVisualDiffState
> {
  private animationFrameId: number | null = null
  private lastTimestamp: number = 0

  public constructor(props: IPathVisualDiffProps) {
    super(props)
    this.state = {
      mode: 'overlay',
      fieldYear: 'field25',
      showControlHandles: true,
      showRobotFootprints: true,
      showZonesAndMarkers: true,
      showNavGrid: false,
      onionSkinOpacity: 0.5,
      isPlaying: false,
      playbackTime: 0.0,
      playbackSpeed: 1.0,
    }
  }

  public componentWillUnmount() {
    this.stopPlayback()
  }

  private getMaxDuration(): number {
    let maxDur = 0.0
    if (this.props.oldPath) {
      const sampled = samplePath(this.props.oldPath)
      if (sampled.length > 0) {
        maxDur = Math.max(
          maxDur,
          sampled[sampled.length - 1].estimatedTimeSeconds
        )
      }
    }
    if (this.props.newPath) {
      const sampled = samplePath(this.props.newPath)
      if (sampled.length > 0) {
        maxDur = Math.max(
          maxDur,
          sampled[sampled.length - 1].estimatedTimeSeconds
        )
      }
    }
    return maxDur
  }

  private togglePlayback = () => {
    if (this.state.isPlaying) {
      this.stopPlayback()
    } else {
      this.startPlayback()
    }
  }

  private startPlayback() {
    this.lastTimestamp = performance.now()
    this.setState({ isPlaying: true })
    this.animationLoop(this.lastTimestamp)
  }

  private stopPlayback() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    this.setState({ isPlaying: false })
  }

  private animationLoop = (timestamp: number) => {
    const dt = (timestamp - this.lastTimestamp) / 1000.0
    this.lastTimestamp = timestamp

    const maxDur = this.getMaxDuration()
    let newTime = this.state.playbackTime + dt * this.state.playbackSpeed

    if (newTime > maxDur) {
      newTime = 0.0
    }

    this.setState({ playbackTime: newTime })
    this.animationFrameId = requestAnimationFrame(this.animationLoop)
  }

  private renderSummary() {
    const { oldPath, newPath } = this.props
    const oldWaypoints = oldPath?.waypoints || []
    const newWaypoints = newPath?.waypoints || []
    const maxCount = Math.max(oldWaypoints.length, newWaypoints.length)

    return (
      <div className="pathplanner-summary-panel">
        <h4 className="summary-title">Path Differences</h4>

        {/* Global Constraints Comparison */}
        {oldPath?.globalConstraints && newPath?.globalConstraints && (
          <div className="summary-card">
            <div className="card-header">Constraints</div>
            <div className="card-body">
              <div className="metric-row">
                <span>Max Vel:</span>
                <span
                  className={
                    oldPath.globalConstraints.maxVelocity !==
                    newPath.globalConstraints.maxVelocity
                      ? 'metric-changed'
                      : ''
                  }
                >
                  {oldPath.globalConstraints.maxVelocity}m/s →{' '}
                  {newPath.globalConstraints.maxVelocity}m/s
                </span>
              </div>
              <div className="metric-row">
                <span>Max Accel:</span>
                <span
                  className={
                    oldPath.globalConstraints.maxAcceleration !==
                    newPath.globalConstraints.maxAcceleration
                      ? 'metric-changed'
                      : ''
                  }
                >
                  {oldPath.globalConstraints.maxAcceleration}m/s² →{' '}
                  {newPath.globalConstraints.maxAcceleration}m/s²
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Waypoints Delta Table */}
        <div className="summary-card">
          <div className="card-header">Waypoints ({newWaypoints.length})</div>
          <div className="waypoints-diff-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Old (x, y)</th>
                  <th>New (x, y)</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxCount }).map((_, i) => {
                  const oldWp = oldWaypoints[i]
                  const newWp = newWaypoints[i]

                  if (!oldWp && newWp) {
                    return (
                      <tr key={i} className="row-added">
                        <td>+{i}</td>
                        <td>—</td>
                        <td>
                          ({newWp.anchor.x.toFixed(2)}, {newWp.anchor.y.toFixed(2)})
                        </td>
                        <td>Added</td>
                      </tr>
                    )
                  }

                  if (oldWp && !newWp) {
                    return (
                      <tr key={i} className="row-removed">
                        <td>-{i}</td>
                        <td>
                          ({oldWp.anchor.x.toFixed(2)}, {oldWp.anchor.y.toFixed(2)})
                        </td>
                        <td>—</td>
                        <td>Removed</td>
                      </tr>
                    )
                  }

                  if (oldWp && newWp) {
                    const dx = newWp.anchor.x - oldWp.anchor.x
                    const dy = newWp.anchor.y - oldWp.anchor.y
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    const isMoved = dist > 0.01

                    return (
                      <tr
                        key={i}
                        className={isMoved ? 'row-modified' : 'row-unchanged'}
                      >
                        <td>{i}</td>
                        <td>
                          ({oldWp.anchor.x.toFixed(2)}, {oldWp.anchor.y.toFixed(2)})
                        </td>
                        <td>
                          ({newWp.anchor.x.toFixed(2)}, {newWp.anchor.y.toFixed(2)})
                        </td>
                        <td>{isMoved ? `Δ ${dist.toFixed(2)}m` : '0'}</td>
                      </tr>
                    )
                  }

                  return null
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  public render() {
    if (this.state.mode === 'raw-json') {
      return (
        <div className="pathplanner-raw-container">
          <PathPlannerDiffHeader
            mode={this.state.mode}
            onModeChanged={mode => this.setState({ mode })}
            fieldYear={this.state.fieldYear}
            onFieldYearChanged={fieldYear => this.setState({ fieldYear })}
            showControlHandles={this.state.showControlHandles}
            onToggleControlHandles={showControlHandles =>
              this.setState({ showControlHandles })
            }
            showRobotFootprints={this.state.showRobotFootprints}
            onToggleRobotFootprints={showRobotFootprints =>
              this.setState({ showRobotFootprints })
            }
            showZonesAndMarkers={this.state.showZonesAndMarkers}
            onToggleZonesAndMarkers={showZonesAndMarkers =>
              this.setState({ showZonesAndMarkers })
            }
            showNavGrid={this.state.showNavGrid}
            onToggleNavGrid={showNavGrid => this.setState({ showNavGrid })}
            onionSkinOpacity={this.state.onionSkinOpacity}
            onOnionSkinOpacityChanged={onionSkinOpacity =>
              this.setState({ onionSkinOpacity })
            }
            isPlaying={this.state.isPlaying}
            onTogglePlayback={this.togglePlayback}
            playbackTime={this.state.playbackTime}
            maxDuration={this.getMaxDuration()}
            onSeekTime={time => this.setState({ playbackTime: time })}
            playbackSpeed={this.state.playbackSpeed}
            onPlaybackSpeedChanged={playbackSpeed =>
              this.setState({ playbackSpeed })
            }
          />
          {this.props.onRenderRawJson()}
        </div>
      )
    }

    const maxDuration = this.getMaxDuration()

    return (
      <div className="pathplanner-visual-diff-layout">
        <PathPlannerDiffHeader
          mode={this.state.mode}
          onModeChanged={mode => this.setState({ mode })}
          fieldYear={this.state.fieldYear}
          onFieldYearChanged={fieldYear => this.setState({ fieldYear })}
          showControlHandles={this.state.showControlHandles}
          onToggleControlHandles={showControlHandles =>
            this.setState({ showControlHandles })
          }
          showRobotFootprints={this.state.showRobotFootprints}
          onToggleRobotFootprints={showRobotFootprints =>
            this.setState({ showRobotFootprints })
          }
          showZonesAndMarkers={this.state.showZonesAndMarkers}
          onToggleZonesAndMarkers={showZonesAndMarkers =>
            this.setState({ showZonesAndMarkers })
          }
          showNavGrid={this.state.showNavGrid}
          onToggleNavGrid={showNavGrid => this.setState({ showNavGrid })}
          onionSkinOpacity={this.state.onionSkinOpacity}
          onOnionSkinOpacityChanged={onionSkinOpacity =>
            this.setState({ onionSkinOpacity })
          }
          isPlaying={this.state.isPlaying}
          onTogglePlayback={this.togglePlayback}
          playbackTime={this.state.playbackTime}
          maxDuration={maxDuration}
          onSeekTime={time => this.setState({ playbackTime: time })}
          playbackSpeed={this.state.playbackSpeed}
          onPlaybackSpeedChanged={playbackSpeed =>
            this.setState({ playbackSpeed })
          }
        />

        <div className="diff-content-row">
          <div className="canvas-presentation-area">
            {this.state.mode === 'overlay' && (
              <FieldCanvas
                oldPath={this.props.oldPath}
                newPath={this.props.newPath}
                settings={this.props.settings}
                navgrid={this.props.navgrid}
                fieldYear={this.state.fieldYear}
                showControlHandles={this.state.showControlHandles}
                showRobotFootprints={this.state.showRobotFootprints}
                showZonesAndMarkers={this.state.showZonesAndMarkers}
                showNavGrid={this.state.showNavGrid}
                playbackTime={this.state.playbackTime}
              />
            )}

            {this.state.mode === 'side-by-side' && (
              <div className="side-by-side-canvases">
                <FieldCanvas
                  title="Before (Commit / Base)"
                  oldPath={this.props.oldPath}
                  newPath={null}
                  settings={this.props.settings}
                  navgrid={this.props.navgrid}
                  fieldYear={this.state.fieldYear}
                  showControlHandles={this.state.showControlHandles}
                  showRobotFootprints={this.state.showRobotFootprints}
                  showZonesAndMarkers={this.state.showZonesAndMarkers}
                  showNavGrid={this.state.showNavGrid}
                  playbackTime={this.state.playbackTime}
                />
                <FieldCanvas
                  title="After (Changes)"
                  oldPath={null}
                  newPath={this.props.newPath}
                  settings={this.props.settings}
                  navgrid={this.props.navgrid}
                  fieldYear={this.state.fieldYear}
                  showControlHandles={this.state.showControlHandles}
                  showRobotFootprints={this.state.showRobotFootprints}
                  showZonesAndMarkers={this.state.showZonesAndMarkers}
                  showNavGrid={this.state.showNavGrid}
                  playbackTime={this.state.playbackTime}
                />
              </div>
            )}

            {this.state.mode === 'onion-skin' && (
              <FieldCanvas
                oldPath={this.props.oldPath}
                newPath={this.props.newPath}
                settings={this.props.settings}
                navgrid={this.props.navgrid}
                fieldYear={this.state.fieldYear}
                showControlHandles={this.state.showControlHandles}
                showRobotFootprints={this.state.showRobotFootprints}
                showZonesAndMarkers={this.state.showZonesAndMarkers}
                showNavGrid={this.state.showNavGrid}
                playbackTime={this.state.playbackTime}
                oldOpacity={1.0 - this.state.onionSkinOpacity}
                newOpacity={this.state.onionSkinOpacity}
              />
            )}
          </div>

          {this.renderSummary()}
        </div>
      </div>
    )
  }
}
