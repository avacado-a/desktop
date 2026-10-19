import * as React from 'react'
import {
  IPathPlannerAuto,
  IPathPlannerPath,
  IPathPlannerSettings,
  INavGrid,
  IAutoCommand,
  PathPlannerDiffViewMode,
} from '../../../models/pathplanner'
import {
  PathPlannerDiffHeader,
  FieldYear,
} from './pathplanner-diff-header'
import { FieldCanvas } from './field-canvas'
import { Octicon } from '../../octicons'
import * as OcticonSymbol from '../../octicons/octicons.generated'

interface IAutoVisualDiffProps {
  readonly oldAuto: IPathPlannerAuto | null
  readonly newAuto: IPathPlannerAuto | null
  readonly oldResolvedPaths: ReadonlyMap<string, IPathPlannerPath>
  readonly newResolvedPaths: ReadonlyMap<string, IPathPlannerPath>
  readonly settings: IPathPlannerSettings
  readonly navgrid: INavGrid
  readonly onRenderRawJson: () => JSX.Element
}

interface IAutoVisualDiffState {
  readonly mode: PathPlannerDiffViewMode
  readonly fieldYear: FieldYear
  readonly showControlHandles: boolean
  readonly showRobotFootprints: boolean
  readonly showZonesAndMarkers: boolean
  readonly showNavGrid: boolean
  readonly onionSkinOpacity: number
  readonly selectedPathName: string | null
}

export class AutoVisualDiff extends React.Component<
  IAutoVisualDiffProps,
  IAutoVisualDiffState
> {
  public constructor(props: IAutoVisualDiffProps) {
    super(props)
    this.state = {
      mode: 'overlay',
      fieldYear: 'field26',
      showControlHandles: false,
      showRobotFootprints: true,
      showZonesAndMarkers: false,
      showNavGrid: false,
      onionSkinOpacity: 0.5,
      selectedPathName: null,
    }
  }

  private renderCommandNode(
    cmd: IAutoCommand,
    key: string,
    diffStatus: 'added' | 'removed' | 'modified' | 'unchanged' = 'unchanged'
  ): JSX.Element {
    let icon = OcticonSymbol.listUnordered
    let badgeText: string = cmd.type

    if (cmd.type === 'path') {
      icon = OcticonSymbol.gitBranch
      badgeText = `path: ${cmd.data.pathName}`
    } else if (cmd.type === 'named') {
      icon = OcticonSymbol.zap
      badgeText = `command: ${cmd.data.name}`
    } else if (cmd.type === 'wait') {
      icon = OcticonSymbol.clock
      badgeText = `wait: ${cmd.data.waitTime}s`
    } else if (cmd.type === 'parallel') {
      icon = OcticonSymbol.gitMerge
    } else if (cmd.type === 'race') {
      icon = OcticonSymbol.flame
    }

    const isSelected =
      cmd.type === 'path' && cmd.data.pathName === this.state.selectedPathName

    return (
      <div
        key={key}
        className={`command-node ${cmd.type} status-${diffStatus} ${
          isSelected ? 'selected' : ''
        }`}
        onClick={() => {
          if (cmd.type === 'path' && cmd.data.pathName) {
            this.setState({
              selectedPathName:
                this.state.selectedPathName === cmd.data.pathName
                  ? null
                  : cmd.data.pathName,
            })
          }
        }}
      >
        <div className="node-title">
          <Octicon symbol={icon} />
          <span className="node-type">{badgeText}</span>
        </div>

        {cmd.data.commands && cmd.data.commands.length > 0 && (
          <div className="nested-commands">
            {cmd.data.commands.map((child, idx) =>
              this.renderCommandNode(child, `${key}-${idx}`, diffStatus)
            )}
          </div>
        )}
      </div>
    )
  }

  private renderCommandTree() {
    const { oldAuto, newAuto } = this.props

    return (
      <div className="auto-command-tree-panel">
        <h4 className="panel-title">Autonomous Command Routine</h4>
        <div className="tree-scroll-container">
          {oldAuto && !newAuto && (
            <div className="tree-side">
              <div className="side-label deleted">Old Routine (Removed)</div>
              {this.renderCommandNode(oldAuto.command, 'old-root', 'removed')}
            </div>
          )}

          {!oldAuto && newAuto && (
            <div className="tree-side">
              <div className="side-label added">New Routine (Added)</div>
              {this.renderCommandNode(newAuto.command, 'new-root', 'added')}
            </div>
          )}

          {oldAuto && newAuto && (
            <div className="tree-side">
              <div className="metadata-bar">
                <span>
                  resetOdom:{' '}
                  {oldAuto.resetOdom !== newAuto.resetOdom ? (
                    <strong className="changed">
                      {String(oldAuto.resetOdom)} → {String(newAuto.resetOdom)}
                    </strong>
                  ) : (
                    String(newAuto.resetOdom)
                  )}
                </span>
                {newAuto.folder && <span>Folder: {newAuto.folder}</span>}
              </div>
              {this.renderCommandNode(newAuto.command, 'new-root', 'unchanged')}
            </div>
          )}
        </div>
      </div>
    )
  }

  public render() {
    if (this.state.mode === 'raw-json') {
      return (
        <div className="pathplanner-raw-container">
          <PathPlannerDiffHeader
            isAuto={true}
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
            isPlaying={false}
            onTogglePlayback={() => {}}
            playbackTime={0}
            maxDuration={0}
            onSeekTime={() => {}}
            playbackSpeed={1}
            onPlaybackSpeedChanged={() => {}}
          />
          {this.props.onRenderRawJson()}
        </div>
      )
    }

    const selectedKey = this.state.selectedPathName
    const oldPath = selectedKey
      ? this.props.oldResolvedPaths.get(selectedKey) || null
      : null
    const newPath = selectedKey
      ? this.props.newResolvedPaths.get(selectedKey) || null
      : null

    const oldPaths = selectedKey
      ? undefined
      : Array.from(this.props.oldResolvedPaths.values())
    const newPaths = selectedKey
      ? undefined
      : Array.from(this.props.newResolvedPaths.values())

    return (
      <div className="auto-visual-diff-layout">
        <PathPlannerDiffHeader
          isAuto={true}
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
          isPlaying={false}
          onTogglePlayback={() => {}}
          playbackTime={0}
          maxDuration={0}
          onSeekTime={() => {}}
          playbackSpeed={1}
          onPlaybackSpeedChanged={() => {}}
        />

        <div className="auto-content-split">
          <div className="field-side">
            <div className="active-path-banner">
              {selectedKey ? (
                <>
                  Previewing Path: <strong>{selectedKey}</strong> (click node to
                  show all)
                </>
              ) : (
                <>
                  Showing All Routine Paths (
                  {Math.max(
                    this.props.newResolvedPaths.size,
                    this.props.oldResolvedPaths.size
                  )}
                  )
                </>
              )}
            </div>
            <FieldCanvas
              oldPath={oldPath}
              newPath={newPath}
              oldPaths={oldPaths}
              newPaths={newPaths}
              settings={this.props.settings}
              navgrid={this.props.navgrid}
              fieldYear={this.state.fieldYear}
              showControlHandles={this.state.showControlHandles}
              showRobotFootprints={this.state.showRobotFootprints}
              showZonesAndMarkers={this.state.showZonesAndMarkers}
              showNavGrid={this.state.showNavGrid}
              playbackTime={0}
            />
          </div>

          <div className="command-tree-side">{this.renderCommandTree()}</div>
        </div>
      </div>
    )
  }
}
