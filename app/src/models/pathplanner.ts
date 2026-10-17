export interface IPoint2D {
  readonly x: number
  readonly y: number
}

export interface IPathWaypoint {
  readonly anchor: IPoint2D
  readonly prevControl: IPoint2D | null
  readonly nextControl: IPoint2D | null
  readonly isLocked?: boolean
  readonly linkedName?: string | null
  readonly isReversal?: boolean
}

export interface IRotationTarget {
  readonly waypointRelativePos: number
  readonly rotationDegrees: number
}

export interface IPathConstraints {
  readonly maxVelocity: number
  readonly maxAcceleration: number
  readonly maxAngularVelocity: number
  readonly maxAngularAcceleration: number
  readonly nominalVoltage?: number
  readonly unlimited?: boolean
}

export interface IConstraintZone {
  readonly name: string
  readonly minWaypointRelativePos: number
  readonly maxWaypointRelativePos: number
  readonly constraints: IPathConstraints
}

export interface IPointTowardsZone {
  readonly name: string
  readonly fieldPosition: IPoint2D
  readonly rotationOffset?: number
  readonly minWaypointRelativePos: number
  readonly maxWaypointRelativePos: number
}

export interface IEventMarker {
  readonly name: string
  readonly waypointRelativePos: number
  readonly endWaypointRelativePos?: number | null
  readonly command?: IAutoCommand | null
}

export interface IEndState {
  readonly velocity: number
  readonly rotation: number
}

export interface IPathPlannerPath {
  readonly version?: string
  readonly waypoints: ReadonlyArray<IPathWaypoint>
  readonly rotationTargets: ReadonlyArray<IRotationTarget>
  readonly constraintZones: ReadonlyArray<IConstraintZone>
  readonly pointTowardsZones: ReadonlyArray<IPointTowardsZone>
  readonly eventMarkers: ReadonlyArray<IEventMarker>
  readonly globalConstraints: IPathConstraints
  readonly goalEndState: IEndState
  readonly idealStartingState?: IEndState
  readonly reversed: boolean
  readonly folder?: string | null
  readonly useDefaultConstraints?: boolean
}

export type AutoCommandType =
  | 'sequential'
  | 'parallel'
  | 'race'
  | 'deadline'
  | 'path'
  | 'named'
  | 'wait'

export interface IAutoCommand {
  readonly type: AutoCommandType
  readonly data: {
    readonly commands?: ReadonlyArray<IAutoCommand>
    readonly pathName?: string
    readonly name?: string
    readonly waitTime?: number
  }
}

export interface IPathPlannerAuto {
  readonly version?: string
  readonly command: IAutoCommand
  readonly resetOdom: boolean
  readonly folder: string | null
  readonly choreoAuto: boolean
}

export interface IPathPlannerSettings {
  readonly robotWidth: number
  readonly robotLength: number
  readonly holonomicMode: boolean
  readonly defaultMaxVel: number
  readonly defaultMaxAccel: number
  readonly defaultMaxAngVel: number
  readonly defaultMaxAngAccel: number
  readonly bumperOffsetX?: number
  readonly bumperOffsetY?: number
  readonly robotFeatures?: ReadonlyArray<string>
}

export interface INavGrid {
  readonly field_size: IPoint2D
  readonly nodeSizeMeters: number
  readonly grid: ReadonlyArray<ReadonlyArray<boolean>>
}

export type PathPlannerDiffViewMode =
  | 'overlay'
  | 'side-by-side'
  | 'onion-skin'
  | 'raw-json'
