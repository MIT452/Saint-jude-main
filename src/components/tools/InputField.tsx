import { Checkbox } from "../ui/checkbox"
import { Input } from "../ui/input"
import { Label } from "../ui/label"

export function InputField({ label, value, onChange, type = "text", readOnly = false, error, placeHolder , checked}: {
  label: string
  value: any
  onChange?: (v: string) => void
  type?: string
  readOnly?: boolean
  error?: string
  placeHolder?: string,
  checked ?: string 
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-card-foreground">{label}</Label>
      <div className="felx">
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder={placeHolder ? `${label} (${placeHolder})` : label}
        />
        {checked &&  <Checkbox>Selectioner</Checkbox>}

        {/* <input type="checkbox" /> */}
      </div>
      {error && <span className="text-red-500 text-sm">{error}</span>}
    </div>
  )
}