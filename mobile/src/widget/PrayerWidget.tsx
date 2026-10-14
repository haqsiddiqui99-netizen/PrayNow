import { FlexWidget, TextWidget, type WidgetInfo } from 'react-native-android-widget'
import { buildPrayerWidgetModel, type PrayerWidgetModel } from './prayerWidgetData'

const INK = '#0F1F2E'
const PAPER = '#EAF3F0'
const MUTED = 'rgba(234, 243, 240, 0.62)'
const CHIP = '#22384C'

/** Below this height (dp) the five-times row is dropped. */
const COMPACT_HEIGHT = 120

function Row({ rtl, children, style }: { rtl: boolean; children: any[]; style?: object }) {
  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: 'match_parent',
        ...style,
      }}
    >
      {rtl ? [...children].reverse() : children}
    </FlexWidget>
  )
}

export function PrayerWidget({ model, compact }: { model: PrayerWidgetModel; compact: boolean }) {
  const align = model.rtl ? 'right' : 'left'

  if (model.empty) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: INK,
          borderRadius: 22,
          padding: 16,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <TextWidget text="PrayNow" style={{ color: PAPER, fontSize: 16, fontWeight: '700' }} />
        <TextWidget
          text={model.empty}
          maxLines={2}
          style={{ color: MUTED, fontSize: 13, marginTop: 4, textAlign: 'center' }}
        />
      </FlexWidget>
    )
  }

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: INK,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <Row rtl={model.rtl}>
        <TextWidget
          text={`${model.label} · ${model.city}`.toUpperCase()}
          maxLines={1}
          truncate="END"
          style={{ color: MUTED, fontSize: 11, fontWeight: '600', letterSpacing: 0.06, textAlign: align }}
        />
        <TextWidget
          text="↻"
          clickAction="REFRESH"
          accessibilityLabel={model.refreshLabel}
          style={{ color: PAPER, fontSize: 18, paddingHorizontal: 6 }}
        />
      </Row>

      <Row rtl={model.rtl} style={{ alignItems: 'flex-end' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          {(model.rtl
            ? [
                <TextWidget key="time" text={model.nextTime} style={{ color: PAPER, fontSize: 16, marginRight: 8 }} />,
                <TextWidget key="name" text={model.nextName} style={{ color: PAPER, fontSize: 26, fontWeight: '700' }} />,
              ]
            : [
                <TextWidget key="name" text={model.nextName} style={{ color: PAPER, fontSize: 26, fontWeight: '700' }} />,
                <TextWidget key="time" text={model.nextTime} style={{ color: PAPER, fontSize: 16, marginLeft: 8 }} />,
              ])}
        </FlexWidget>
        <TextWidget text={model.countdown} style={{ color: MUTED, fontSize: 14, fontWeight: '600' }} />
      </Row>

      {compact ? null : (
        <Row rtl={model.rtl} style={{ marginTop: 6 }}>
          {model.times.map((slot) => (
            <FlexWidget
              key={slot.key}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 5,
                marginHorizontal: 2,
                borderRadius: 10,
                backgroundColor: slot.next ? CHIP : INK,
              }}
            >
              <TextWidget
                text={slot.name}
                maxLines={1}
                style={{ color: slot.next ? PAPER : MUTED, fontSize: 11, fontWeight: slot.next ? '700' : '500' }}
              />
              <TextWidget
                text={slot.time}
                maxLines={1}
                style={{ color: PAPER, fontSize: 14, fontWeight: slot.next ? '700' : '500', marginTop: 1 }}
              />
            </FlexWidget>
          ))}
        </Row>
      )}

      {model.note ? (
        <TextWidget
          text={model.note}
          maxLines={1}
          truncate="END"
          style={{ color: MUTED, fontSize: 11, marginTop: 4, textAlign: align }}
        />
      ) : null}
    </FlexWidget>
  )
}

export async function renderPrayerWidget(info: Pick<WidgetInfo, 'height'>) {
  const model = await buildPrayerWidgetModel()
  return <PrayerWidget model={model} compact={info.height < COMPACT_HEIGHT} />
}
