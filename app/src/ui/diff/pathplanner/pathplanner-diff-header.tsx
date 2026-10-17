import * as React from 'react'
import { PathPlannerDiffViewMode } from '../../../models/pathplanner'
import { Button } from '../../lib/button'
import { Octicon } from '../../octicons'
import * as OcticonSymbol from '../../octicons/octicons.generated'
import { Checkbox, CheckboxValue } from '../../lib/checkbox'

export type FieldYear = 'field26' | 'field25' | 'field24' | 'grid-only'

interface IPathPlannerDiffHeaderProps {
  readonly mode: PathPlannerDiffViewMode
  readonly onModeChanged: (mode: PathPlannerDiffViewMode) => void

  readonly fieldYear: FieldYear
  readonly onFieldYearChanged: (year: FieldYear) => void

  readonly showControlHandles: boolean
  readonly onToggleControlHandles: (checked: boolean) => void

  readonly showRobotFootprints: boolean
  readonly onToggleRobotFootprints: (checked: boolean) => void

  readonly showZonesAndMarkers: boolean
  readonly onToggleZonesAndMarkers: (checked: boolean) => void

  readonly showNavGrid: boolean
  readonly onToggleNavGrid: (checked: boolean) => void

  readonly onionSkinOpacity: number
  readonly onOnionSkinOpacityChanged: (opacity: number) => void

  readonly isPlaying: boolean
  readonly onTogglePlayback: () => void
  readonly playbackTime: number
  readonly maxDuration: number
  readonly onSeekTime: (time: number) => void
  readonly playbackSpeed: number
  readonly onPlaybackSpeedChanged: (speed: number) => void
}

export class PathPlannerDiffHeader extends React.Component<IPathPlannerDiffHeaderProps> {
  public render() {
    return (
      <div className="pathplanner-diff-header">
        <div className="diff-view-modes">
          <span className="mode-label">View:</span>
          <div className="segmented-control">
            <Button
              className={this.props.mode === 'overlay' ? 'active' : ''}
              onClick={() => this.props.onModeChanged('overlay')}
            >
              Overlay
            </Button>
            <Button
              className={this.props.mode === 'side-by-side' ? 'active' : ''}
              onClick={() => this.props.onModeChanged('side-by-side')}
            >
              Side-by-Side
            </Button>
            <Button
              className={this.props.mode === 'onion-skin' ? 'active' : ''}
              onClick={() => this.props.onModeChanged('onion-skin')}
            >
              Onion Skin
            </Button>
            <Button
              className={this.props.mode === 'raw-json' ? 'active' : ''}
              onClick={() => this.props.onModeChanged('raw-json')}
            >
              Raw JSON
            </Button>
          </div>
        </div>

        {this.props.mode === 'onion-skin' && (
          <div className="onion-skin-slider-container">
            <span>Old</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={this.props.onionSkinOpacity}
              onChange={e =>
                this.props.onOnionSkinOpacityChanged(parseFloat(e.target.value))
              }
            />
            <span>New</span>
          </div>
        )}

        <div className="field-and-layers">
          <select
            className="field-selector"
            value={this.props.fieldYear}
            onChange={e =>
              this.props.onFieldYearChanged(e.target.value as FieldYear)
            }
          >
            <option value="field26">2026 Field</option>
            <option value="field25">2025 Reefscape</option>
            <option value="field24">2024 Crescendo</option>
            <option value="grid-only">Grid Only</option>
          </select>

          <Checkbox
            label="Handles"
            value={
              this.props.showControlHandles
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={e =>
              this.props.onToggleControlHandles(
                e.currentTarget.checked
              )
            }
          />
          <Checkbox
            label="Chassis"
            value={
              this.props.showRobotFootprints
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={e =>
              this.props.onToggleRobotFootprints(
                e.currentTarget.checked
              )
            }
          />
          <Checkbox
            label="Zones/Markers"
            value={
              this.props.showZonesAndMarkers
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={e =>
              this.props.onToggleZonesAndMarkers(
                e.currentTarget.checked
              )
            }
          />
          <Checkbox
            label="NavGrid"
            value={
              this.props.showNavGrid ? CheckboxValue.On : CheckboxValue.Off
            }
            onChange={e =>
              this.props.onToggleNavGrid(
                e.currentTarget.checked
              )
            }
          />
        </div>

        {this.props.maxDuration > 0 && this.props.mode !== 'raw-json' && (
          <div className="scrubber-controls">
            <Button
              className="playback-btn"
              onClick={this.props.onTogglePlayback}
            >
              <Octicon
                symbol={
                  this.props.isPlaying
                    ? OcticonSymbol.stop
                    : OcticonSymbol.play
                }
              />
            </Button>
            <span className="time-display">
              {this.props.playbackTime.toFixed(1)}s /{' '}
              {this.props.maxDuration.toFixed(1)}s
            </span>
            <input
              type="range"
              className="time-slider"
              min="0"
              max={this.props.maxDuration}
              step="0.05"
              value={this.props.playbackTime}
              onChange={e =>
                this.props.onSeekTime(parseFloat(e.target.value))
              }
            />
            <select
              className="speed-selector"
              value={this.props.playbackSpeed}
              onChange={e =>
                this.props.onPlaybackSpeedChanged(parseFloat(e.target.value))
              }
            >
              <option value="0.5">0.5x</option>
              <option value="1">1.0x</option>
              <option value="2">2.0x</option>
            </select>
          </div>
        )}
      </div>
    )
  }
}
