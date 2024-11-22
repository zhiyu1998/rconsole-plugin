export default function Toast({ id }) {
    return (
        <div id={ id } className="toast toast-top toast-end hidden z-[9999]">
            <div className="alert alert-success">
                <span>配置保存成功！</span>
            </div>
        </div>
    );
};
