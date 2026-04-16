export default function Title({ title }: { title: string }) {
    return (<div className="mt-3 mb-4">
        <div className="Inter text-2xl font-bold text-gray-800">{title}</div>
    </div>)
}